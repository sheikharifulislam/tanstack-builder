import { Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { useFormStore } from "@/hooks/use-form-store";
import { clientTools } from "@tanstack/ai-client";
import { generateFormDef } from "@/lib/ai/form-tools";
import { v4 as uuid } from "uuid";

import { useState } from "react";

export function FormGenerator() {
	const { actions } = useFormStore();
	const [input, setInput] = useState("");
	const [formMetadata, setFormMetadata] = useState<{
		title?: string;
		description?: string;
	}>({});

	// Client tool that updates form state when AI calls it with generated form data
	const generateFormTool = generateFormDef.client(({ title, description, formElements }) => {
		console.log("Client: generate_form called with:", title, description);

		try {
			// Add unique IDs to elements that don't have them
			const elementsWithIds = formElements.map((el: any) => {
				if (Array.isArray(el)) {
					return el.map((e: any) => ({
						...e,
						id: e.id || uuid(),
					}));
				}
				return {
					...el,
					id: el.id || uuid(),
				};
			});

			// Update form store
			actions.setFormElements(elementsWithIds as any);

			// Update form metadata
			setFormMetadata({ title, description });
			if (title) {
				actions.setFormName(title.toLowerCase().replace(/\s+/g, "_"));
			}

			// Return success
			return {
				success: true,
				message: `Form "${title}" generated successfully`,
				fieldCount: formElements.length
			};
		} catch (error) {
			console.error("Error updating form:", error);
			return {
				success: false,
				message: `Error: ${error}`,
				fieldCount: 0
			};
		}
	});

	const { messages, sendMessage, isLoading  , error} = useChat({
		connection: fetchServerSentEvents("/api/ai"),
		tools: clientTools(generateFormTool),
	});
	console.log(error)
	// No useEffect needed - the client tool handles the action directly when called

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (input.trim() && !isLoading) {
			sendMessage(input);
			setInput("");
		}
	};
	return (
		<div className="flex flex-col h-full">
			<div className="mb-4 p-4 border-b">
				<h3 className="text-lg font-semibold text-primary">
					{formMetadata.title || "Generate"}
				</h3>
				<p className="text-sm text-muted-foreground">
					{formMetadata.description || "Generate forms with AI"}
				</p>
			</div>

			<ScrollArea className="flex-1 min-h-0">
			<div className="p-4 space-y-6">
				{messages.length === 0 ? (
					<>
						<div className="space-y-4">
							<h2 className="text-2xl font-bold tracking-tight">
								What can I help you build?
							</h2>
						</div>

						<div className="space-y-2">
							{[
								"Contact form with name, email, and message",
								"Job application form with resume upload",
								"Feedback survey with rating scale",
								"Event registration form with payment details",
								"Login form with email and password",
							].map((suggestion, i) => (
								<Button
									key={i}
									variant="ghost"
									onClick={() => sendMessage(suggestion)}
									className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
								>
									{suggestion}
								</Button>
							))}
						</div>
					</>
				) : (
					<div className="space-y-4">
						{messages.map((message) => (
							<div
								key={message.id}
								className={`p-3 rounded-lg ${
									message.role === "assistant"
										? "bg-muted/50"
										: "bg-primary/10"
								}`}
							>
								<div className="font-semibold text-sm mb-1 text-muted-foreground">
									{message.role === "assistant" ? "Assistant" : "You"}
								</div>
								<div className="space-y-2">
									{message.parts.map((part, idx) => {
										if (part.type === "text") {
											return (
												<div key={idx} className="text-sm">
													{part.content}
												</div>
											);
										}
										if (part.type === "tool-call" && part.name === "generate_form") {
											const output = part.output as { success?: boolean; fieldCount?: number; message?: string };
											const fieldCount = output?.fieldCount || 0;
											const success = output?.success !== false;
											return (
												<div
													key={idx}
													className={`flex items-center gap-2 text-sm p-2 rounded-md ${
														success
															? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
															: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
													}`}
												>
													<Sparkles className="w-4 h-4" />
													<span>
														✓ Generated {fieldCount} form field{fieldCount !== 1 ? "s" : ""}
													</span>
												</div>
											);
										}
										return null;
									})}
								</div>
							</div>
						))}
						{isLoading && (
							<div className="p-3 rounded-lg bg-muted/50">
								<div className="font-semibold text-sm mb-1 text-muted-foreground">
									Assistant
								</div>
								<div className="text-sm text-muted-foreground animate-pulse">
									Thinking...
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</ScrollArea>

			<div className="p-4 border-t mt-auto">
				<form onSubmit={handleSubmit} className="relative">
					<Textarea
						placeholder="Describe your form..."
						className="min-h-[100px] resize-none pr-12 pb-12 bg-muted/50 border-none focus-visible:ring-1"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmit(e);
							}
						}}
					/>

					<div className="absolute bottom-3 left-3 flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 text-xs gap-1.5"
							onClick={() => window.location.reload()}
						>
							<Sparkles className="w-3 h-3" />
							New chat
						</Button>
						{/* <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
							<Image className="w-3 h-3" />
							Image
						</Button> */}
					</div>

					<Button
						type="submit"
						size="icon"
						disabled={isLoading || !input.trim()}
						className="absolute bottom-3 right-3 h-8 w-8 rounded-lg"
					>
						<Send className="w-4 h-4" />
					</Button>
				</form>
			</div>
		</div>
	);
}
