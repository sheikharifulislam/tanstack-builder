import { Heart, Table } from "lucide-react";
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
import { tableTemplates } from "@/constants/table-templates";
import {
	applyTemplate as applyBuiltInTemplate,
	deleteTableTemplate,
	getSavedTableTemplates,
	loadTableTemplate,
} from "@/services/table-builder.service";
import { DeleteIcon } from "../ui/delete";
import { LinkIcon } from "../ui/link";

export function TableTemplates() {
	// Directly call getSavedTableTemplates() - it reads from localStorage each time
	// No need for useState + useEffect since we re-render after operations
	const [refreshKey, setRefreshKey] = useState(0);
	const savedTemplates = getSavedTableTemplates();

	const handleApplyTemplate = (templateKey: string) => {
		const success = applyBuiltInTemplate(templateKey);
		if (success) {
			toast("Template applied successfully");
		} else {
			toast("Failed to apply template");
		}
	};

	const applySavedTemplate = (templateId: string) => {
		const success = loadTableTemplate(templateId);
		if (success) {
			toast("Saved table loaded successfully");
			setRefreshKey((k) => k + 1);
		} else {
			toast("Failed to load saved table");
		}
	};

	const deleteSavedTemplate = (templateId: string, templateName: string) => {
		const success = deleteTableTemplate(templateId);
		if (success) {
			toast(`Template "${templateName}" deleted`);
			setRefreshKey((k) => k + 1);
		} else {
			toast("Failed to delete template");
		}
	};

	const handleCopyCommand = (commandUrl: string) => {
		navigator.clipboard.writeText(`pnpm dlx shadcn@canary add ${commandUrl}`);
		toast("Command copied to clipboard!");
	};

	// Use refreshKey in a comment to avoid unused variable warning
	void refreshKey;

	return (
		<div className="flex flex-col h-full md:h-full max-h-[35vh] md:max-h-none">
			<div className="mb-4 p-4 border-b">
				<h3 className="text-lg font-semibold text-primary">Table Templates</h3>
				<p className="text-sm text-muted-foreground">
					Predefined table templates
				</p>
			</div>
			<ScrollArea className="flex-1 overflow-auto max-h-[calc(35vh-8rem)] md:max-h-none">
				<div className="px-3 sm:px-4 space-y-4 sm:space-y-6">
					{savedTemplates.length > 0 && (
						<div>
							<h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
								<Heart className="size-4" />
								Saved Tables
							</h3>
							<div className="space-y-2">
								{savedTemplates.map((template) => (
									<div key={template.id} className="flex items-center gap-1">
										<Button
											onClick={() => applySavedTemplate(template.id)}
											className="justify-start text-[12px] flex-1"
											variant="ghost"
										>
											<Table className="size-4 mr-2" />
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
												deleteSavedTemplate(template.id, template.name)
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
					<div>
						<h3 className="text-sm font-medium text-muted-foreground mb-2">
							Templates
						</h3>
						<div className="space-y-2">
							{Object.entries(tableTemplates).map(([key, template]) => (
								<Button
									key={key}
									onClick={() => handleApplyTemplate(key)}
									className="justify-start text-[12px] w-full"
									variant="ghost"
								>
									<Table className="size-4 mr-2" />
									{template.name}
								</Button>
							))}
						</div>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
}
