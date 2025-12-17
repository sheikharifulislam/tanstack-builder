import { clientTools } from "@tanstack/ai-client";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { AlertTriangle, Circle, Loader2, Send, Sparkles, Square, User, X } from "lucide-react";
import { useState } from "react";
import { v4 as uuid } from "uuid";
import * as z from "zod";
import { AnimatedBotIcon } from "@/components/ui/animated-bot-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppForm } from "@/components/ui/tanstack-form";
import { Textarea } from "@/components/ui/textarea";
import { generateFormDef } from "@/lib/ai/form-tools";
import {
	setFormElements,
	setFormName,
	setIsMS,
} from "@/services/form-builder.service";
import { cn } from "@/utils/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";


const formGeneratorSchema = z.object({
	input: z.string().min(1, "Please describe your form"),
});

export function FormGenerator() {
	const formGeneratorForm = useAppForm({
		defaultValues: {
			input: "",
		},
		validators: {
			onDynamic: formGeneratorSchema,
			onDynamicAsyncDebounceMs: 150,
		},
		onSubmit: async ({ value }) => {
			if (value.input.trim()) {
				sendMessage(value.input);
				formGeneratorForm.reset();
			}
		},
	});

	const [formMetadata, setFormMetadata] = useState<{
		title?: string;
		description?: string;
	}>({});

	const [chatError, setChatError] = useState<string | null>(null);

	// Normalize field to match Valibot schema requirements
	const normalizeField = (field: any): any => {
		const normalized = { ...field };

		// Password fieldType requires type: "password"
		if (normalized.fieldType === "Password" && !normalized.type) {
			normalized.type = "password";
		}

		// Static elements need static: true
		if (
			[
				"H1",
				"H2",
				"H3",
				"Separator",
				"FieldDescription",
				"FieldLegend",
			].includes(normalized.fieldType)
		) {
			normalized.static = true;
		}

		// Select/RadioGroup/ToggleGroup/MultiSelect need options array
		if (
			["Select", "RadioGroup", "ToggleGroup", "MultiSelect"].includes(
				normalized.fieldType,
			)
		) {
			if (!normalized.options) {
				normalized.options = [];
			}
		}

		// Select/MultiSelect need placeholder
		if (
			["Select", "MultiSelect"].includes(normalized.fieldType) &&
			!normalized.placeholder
		) {
			normalized.placeholder = `Select ${normalized.label || normalized.name}...`;
		}

		// FormArray needs entries array initialized
		if (normalized.fieldType === "FormArray") {
			if (!normalized.entries) {
				normalized.entries = [];
			}
			if (!normalized.arrayField) {
				normalized.arrayField = [];
			}
		}

		return normalized;
	};

	// Helper to ensure all elements have IDs and are normalized
	const ensureIds = (elements: any[]): any[] => {
		return elements.map((el: any) => {
			if (Array.isArray(el)) {
				return ensureIds(el);
			}
			const normalized = normalizeField(el);
			const withId = { ...normalized, id: normalized.id || uuid() };
			// Handle FormArray fields
			if (withId.fieldType === "FormArray" && withId.arrayField) {
				withId.arrayField = ensureIds(withId.arrayField);
				withId.entries = (withId.entries || []).map((entry: any) => ({
					id: entry.id || uuid(),
					fields: ensureIds(entry.fields || []),
				}));
			}
			return withId;
		});
	};

	// Transform consecutive grouped fields into nested arrays for side-by-side layout
	const groupFields = (elements: any[]): any[] => {
		const result: any[] = [];
		let currentGroup: any[] = [];

		for (const el of elements) {
			// Skip already nested arrays (shouldn't happen from AI, but be safe)
			if (Array.isArray(el)) {
				// Flush current group first
				if (currentGroup.length > 0) {
					result.push(
						currentGroup.length === 1 ? currentGroup[0] : currentGroup,
					);
					currentGroup = [];
				}
				result.push(el);
				continue;
			}

			if (el.grouped) {
				// Remove the grouped property (it's just a hint for transformation)
				const { grouped: _, ...fieldWithoutGrouped } = el;
				currentGroup.push(fieldWithoutGrouped);
			} else {
				// Flush current group
				if (currentGroup.length > 0) {
					result.push(
						currentGroup.length === 1 ? currentGroup[0] : currentGroup,
					);
					currentGroup = [];
				}
				result.push(el);
			}
		}

		// Flush remaining group
		if (currentGroup.length > 0) {
			result.push(currentGroup.length === 1 ? currentGroup[0] : currentGroup);
		}

		return result;
	};

	// Process elements: ensure IDs, then group consecutive grouped fields
	const processElements = (elements: any[]): any[] => {
		const withIds = ensureIds(elements);
		return groupFields(withIds);
	};

	// Check if elements already have H1 and FieldDescription at the start
	const hasHeaderElements = (elements: any[]): boolean => {
		if (elements.length < 2) return false;
		const first = Array.isArray(elements[0]) ? elements[0][0] : elements[0];
		const second = Array.isArray(elements[1]) ? elements[1][0] : elements[1];
		return first?.fieldType === "H1" && second?.fieldType === "FieldDescription";
	};

	// Create header elements from title and description
	const createHeaderElements = (title: string, description: string): any[] => {
		return [
			{
				id: uuid(),
				name: `H1_${Date.now()}`,
				static: true,
				content: title,
				fieldType: "H1",
			},
			{
				id: uuid(),
				name: `FieldDescription_${Date.now()}`,
				static: true,
				content: description,
				fieldType: "FieldDescription",
			},
		];
	};

	// Client tool that updates form state when AI calls it with generated form data
	const generateFormTool = generateFormDef.client(
		({ title, description, isMultiStep, formElements, steps }) => {

			try {
				let fieldCount = 0;

				if (isMultiStep && steps && steps.length > 0) {
					// Multi-step form: convert steps to form elements with stepFields
					// Add header elements to the first step if not present
					const stepsWithIds = steps.map((step: any, index: number) => {
						let stepFields = processElements(step.stepFields || []);
						// Add header to first step only if not already present
						if (index === 0 && title && description && !hasHeaderElements(stepFields)) {
							stepFields = [...createHeaderElements(title, description), ...stepFields];
						}
						return {
							id: step.id || uuid(),
							stepFields,
						};
					});
					// Set multi-step mode first
					setIsMS(true);
					setFormElements(stepsWithIds as any);
					fieldCount = steps.reduce(
						(acc: number, step: any) => acc + (step.stepFields?.length || 0),
						0,
					);
				} else if (formElements && formElements.length > 0) {
					// Single-page form
					let elementsWithIds = processElements(formElements);

					// Prepend header elements if not already present
					if (title && description && !hasHeaderElements(elementsWithIds)) {
						elementsWithIds = [...createHeaderElements(title, description), ...elementsWithIds];
					}

					// setFormElements also sets isMS internally based on the structure
					setFormElements(elementsWithIds as any);
					fieldCount = formElements.length;
				}

				// Update form metadata
				setFormMetadata({ title, description });
				if (title) {
					setFormName(title.toLowerCase().replace(/\s+/g, "_"));
				}

				// Return success
				return {
					success: true,
					message: `Form "${title}" generated successfully${isMultiStep ? ` with ${steps?.length || 0} steps` : ""}`,
					fieldCount,
				};
			} catch (error) {
				return {
					success: false,
					message: `Error: ${error}`,
					fieldCount: 0,
				};
			}
		},
	);

	const { messages, sendMessage, isLoading , stop} = useChat({
		connection: fetchServerSentEvents("/api/ai"),
		tools: clientTools(generateFormTool),
		onError: () => {
			// Set error state for UI display
			toast.error("An error occurred during chat.");
		},
	});

	// No useEffect needed - the client tool handles the action directly when called
	return (
		<div className="flex flex-col h-full">
			<div className="mb-4 p-4 border-b">
				<h3 className="text-lg font-semibold text-primary flex items-center gap-2">
					{formMetadata.title || "Generate"}
					<Badge variant="secondary">Beta</Badge>
				</h3>
				<p className="text-sm text-muted-foreground">
					{"Generate forms with AI"}
				</p>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="p-4 space-y-6 px-3">
					{messages.length === 0 ? (
						<>
							<div className="space-y-4">
								<h2 className="text-2xl font-bold tracking-tight">
									What can I help you build?
								</h2>
							</div>

							<div className="">
								{[
									{
										title: "Simple Login Form",
										prompt: `Create a login form with email and password fields, a "Remember me" checkbox, and make both email and password required.`,
									},
									{
										title: "Side-by-Side Contact Form",
										prompt: `Create a contact form with first name and last name side by side, email below, then city, state, and zip code all side by side, followed by a message textarea and a terms checkbox.`,
									},
									{
										title: "Dynamic Team Members (Field Array)",
										prompt: `Create a team registration form with a field array for team members. Each team member entry should have name, email, and role fields. Also include a team name field at the top.`,
									},
									{
										title: "Event Registration with Payment",
										prompt: `Generate an event registration form with attendee name, email, phone, ticket type (select: VIP, Standard, Student), number of tickets (slider 1-10), dietary restrictions (checkboxes), and a special requests textarea.`,
									},
													{
										title: "Multi-Step Job Application",
										prompt: `Generate a multi-step job application form.
Step 1: Personal info (first name and last name side by side, email, phone).
Step 2: Education (school name, degree, graduation year).
Step 3: Work experience (company name, job title, start and end dates side by side).
Step 4: Skills (checkboxes for HTML, CSS, JavaScript, React, Node.js).
Include validations for required fields and clear step titles.`,
									},
								].map((suggestion, i) => (
									<Button
										key={i}
										variant="ghost"
										onClick={() => formGeneratorForm.setFieldValue("input", suggestion.prompt)}
										className={cn("flex flex-start justify-start w-full text-left bg-background pl-1 py-1 rounded-none",i !== 4 ? "border-b" : "")}
									>
										<span className="font-medium text-left text-foreground">{suggestion.title}</span>
									</Button>
								))}
							</div>
						</>
					) : (
						<div className="space-y-6">
							{messages.map((message) => (
								<div
									key={message.id}
									className={`flex gap-3 ${
										message.role === "user" ? "flex-row-reverse" : "flex-row"
									}`}
								>
									<Avatar className="h-8 w-8">
										<AvatarFallback
											className={
												message.role === "assistant"
													? "bg-primary/10 text-primary"
													: "bg-muted text-muted-foreground"
											}
										>
											{message.role === "assistant" ? (
												<AnimatedBotIcon
													size={24}
													className={`${isLoading ? "rounded-full border-2 border-primary animate-pulse" : ""}`}
												/>
											) : (
												<User className="h-4 w-4" />
											)}
										</AvatarFallback>
									</Avatar>
									<div
										className={`flex flex-col gap-2 max-w-[85%] ${
											message.role === "user" ? "items-end" : "items-start"
										}`}
									>
										{/* <div className="text-xs text-muted-foreground">
											{message.role === "assistant" ? "Assistant" : "You"}
										</div> */}
										<div className="space-y-2">
											{message.parts.map((part, idx) => {
												if (part.type === "text") {
													return (
														<Streamdown
															key={idx}
															className={`text-sm p-3 rounded-lg ${
																message.role === "user"
																	? "bg-primary text-primary-foreground"
																	: "bg-muted/50"
															}`}
														>
															{part.content}
														</Streamdown>
													);
												}
												if (
													part.type === "tool-call" &&
													part.name === "generate_form"
												) {
													const output = part.output as
														| {
																success?: boolean;
																fieldCount?: number;
																message?: string;
														  }
														| undefined;
													const isPending = !output;
													const fieldCount = output?.fieldCount || 0;
													const success = output?.success !== false;

													return (
														<Card
															key={idx}
															className="p-3 my-2 border shadow-sm w-full"
														>
															<div className="flex items-center gap-3">
																<div
																	className={`p-2 rounded-full ${
																		isPending
																			? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
																			: success
																				? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
																				: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
																	}`}
																>
																	{isPending ? (
																		<Loader2 className="w-4 h-4 animate-spin" />
																	) : (
																		<Sparkles className="w-4 h-4" />
																	)}
																</div>
																<div className="flex-1">
																	<div className="font-medium text-sm">
																		{isPending
																			? "Generating form..."
																			: success
																				? "Form Generated"
																				: "Generation Failed"}
																	</div>
																	<div className="text-xs text-muted-foreground">
																		{isPending
																			? "AI is building your form structure"
																			: output?.message ||
																				`Successfully created ${fieldCount} fields`}
																	</div>
																</div>
															</div>
														</Card>
													);
												}
												return null;
											})}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</ScrollArea>

			<div className="p-4 border-t mt-auto">
				<formGeneratorForm.AppForm>
					<formGeneratorForm.Form className="relative">
						<formGeneratorForm.AppField name="input">
							{(field) => (
								<field.Field>
									<div className={cn(
										"relative rounded-lg border bg-muted focus-within:ring-1 focus-within:ring-ring",
										chatError ? "border-destructive dark:border-destructive" : "border-input"
									)}>
										{/* Error Banner inside container */}
										{/* {chatError && (
											<div className="flex items-center justify-between gap-2 px-1 py-1 text-sm bg-destructive dark:bg-destructive/30 border-b border-destructive/20 dark:border-destructive/80 text-destructive dark:text-destructive rounded-t-lg">
												<div className="flex items-center gap-2">
													<AlertTriangle className="w-2 h-2 flex-shrink-0" />
													<span className="truncate text-destructive-foreground">{chatError}</span>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-2 w-2 pr-3 text-destructive-foreground hover:text-destructive-foreground"
													onClick={() => setChatError(null)}
												>
													<X className="w-2 h-2" />
												</Button>
											</div>
										)} */}

										<Textarea
											name="input"
											placeholder="Describe your form..."
											className="min-h-[100px] resize-none pr-12 pb-12 bg-transparent border-none focus-visible:ring-0 shadow-none"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => {
												field.handleChange(e.target.value);
												// Clear error when user starts typing
												if (chatError) setChatError(null);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.shiftKey) {
													e.preventDefault();
													formGeneratorForm.handleSubmit();
												}
											}}
										/>
									</div>
								</field.Field>
							)}
						</formGeneratorForm.AppField>

						{isLoading ? (
							<Button
								type="button"
								size="icon"
								variant="destructive"
								onClick={() => stop()}
								className="absolute bottom-3 right-3 h-8 w-8 rounded-lg"
							>
								<Circle className="w-4 h-4 animate-spin" />
							</Button>
						) : (
							<Button
								type="submit"
								size="icon"
								className="absolute bottom-3 right-3 h-8 w-8 rounded-lg"
							>
								<Send className="w-4 h-4" />
							</Button>
						)}
					</formGeneratorForm.Form>
				</formGeneratorForm.AppForm>
			</div>
		</div>
	);
}
