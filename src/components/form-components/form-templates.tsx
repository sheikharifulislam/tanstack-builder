import { FileStack, Heart, SquareStack } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { templates } from "@/constants/templates";
import {
	deleteFormTemplate,
	getSavedFormTemplates,
	loadFormTemplate,
	setTemplate,
} from "@/services/form-builder.service";
import { DeleteIcon } from "../ui/delete";
import { LinkIcon } from "../ui/link";

const formTemplates = Object.entries(templates).map((template) => ({
	label: template[1].name,
	value: template[0],
	isMS: template[1].template.some((el) => Object.hasOwn(el, "stepFields")),
}));

export function TemplateSidebar() {
	const [searchQuery, _setSearchQuery] = useState("");
	// Directly call getSavedFormTemplates() - it reads from localStorage each time
	// No need for useState + useEffect since we re-render after operations
	const [refreshKey, setRefreshKey] = useState(0);
	const savedForms = getSavedFormTemplates();

	const handleLoadSavedForm = (formId: string) => {
		const success = loadFormTemplate(formId);
		if (success) {
			toast("Form loaded successfully");
		} else {
			toast("Failed to load form");
		}
		// Trigger re-render to refresh the list
		setRefreshKey((k) => k + 1);
	};

	const handleDeleteSavedForm = (formId: string, formName: string) => {
		const success = deleteFormTemplate(formId);
		if (success) {
			toast(`Form "${formName}" deleted`);
		} else {
			toast("Failed to delete form");
		}
		// Trigger re-render to refresh the list
		setRefreshKey((k) => k + 1);
	};

	const handleCopyCommand = (commandUrl: string) => {
		navigator.clipboard.writeText(`pnpm dlx shadcn@canary add ${commandUrl}`);
		toast("Command copied to clipboard!");
	};

	const filteredTemplates = searchQuery
		? formTemplates.filter((template) =>
				template.label.toLowerCase().includes(searchQuery.toLowerCase()),
			)
		: formTemplates;

	// Use refreshKey in a comment to avoid unused variable warning
	void refreshKey;

	return (
		<div className="flex flex-col h-full">
			<div className="mb-4 p-4 border-b">
				<h3 className="text-lg font-semibold text-primary">Template</h3>
				<p className="text-sm text-muted-foreground">Predefined Template's</p>
			</div>
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-3 sm:p-4 space-y-4 sm:space-y-6">
					{/* Saved Forms */}
					{savedForms.length > 0 && (
						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
								<Heart className="size-4" />
								Saved Forms
							</h3>
							<div className="space-y-2">
								{savedForms.map((template) => (
									<div key={template.id} className="flex items-center gap-1">
										<Button
											onClick={() => handleLoadSavedForm(template.id)}
											className="justify-start text-[12px] flex-1"
											variant="ghost"
										>
											<FileStack className="size-4 mr-2" />
											{template.name}
										</Button>
										{template.generatedCommandUrl && (
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															onClick={() =>
																handleCopyCommand(
																	// biome-ignore lint/style/noNonNullAssertion: Safe because button only renders when truthy
																	template.generatedCommandUrl!,
																)
															}
															size="sm"
															variant="ghost"
															className="text-primary hover:text-primary"
														>
															<LinkIcon className="size-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														<p>Copy shadcn command</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										)}
										<Button
											onClick={() =>
												handleDeleteSavedForm(template.id, template.name)
											}
											size="sm"
											variant="ghost"
											className="text-destructive hover:text-destructive"
										>
											<DeleteIcon className="size-4" />
										</Button>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Built-in Templates */}
					{filteredTemplates.length > 0 && (
						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-2">
								Templates
							</h3>
							<div className="space-y-2">
								{filteredTemplates.map(({ label, value, isMS }) => (
									<Button
										key={label}
										onClick={() => setTemplate(value)}
										className="justify-start text-[12px] w-full"
										variant="ghost"
									>
										{isMS ? (
											<SquareStack className="size-4 mr-2" />
										) : (
											<FileStack className="size-4 mr-2" />
										)}
										{label}
									</Button>
								))}
							</div>
						</div>
					)}

					{/* No results message */}
					{filteredTemplates.length === 0 &&
						savedForms.length === 0 &&
						searchQuery && (
							<div className="text-sm text-muted-foreground p-3">
								No templates or saved forms match your query
							</div>
						)}

					{/* Empty state when no saved forms */}
					{filteredTemplates.length === 0 &&
						savedForms.length === 0 &&
						!searchQuery && (
							<div className="text-sm text-muted-foreground p-3">
								No saved forms yet. Save a form to see it here.
							</div>
						)}
				</div>
			</ScrollArea>
		</div>
	);
}
