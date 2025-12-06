import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

// Schema for form field options (radio/select/togglegroup)
const OptionSchema = z.object({
  value: z.string().describe("The value of the option"),
  label: z.string().describe("The display label for the option"),
});

// Comprehensive schema for all form elements
const FormElementSchema = z.object({
  id: z.string().describe("Unique identifier for the field - use UUID format"),
  fieldType: z.enum([
    "Input",
    "Textarea",
    "Checkbox",
    "RadioGroup",
    "Select",
    "MultiSelect",
    "Switch",
    "DatePicker",
    "Slider",
    "ToggleGroup",
    "Separator",
    "FileUpload",
  ]).describe("The type of form field to render"),
  name: z.string().describe("Field name attribute - use snake_case (e.g., 'email_address')"),
  label: z.string().optional().describe("Display label for the field"),
  description: z.string().optional().describe("Help text shown below the field"),
  placeholder: z.string().optional().describe("Placeholder text for input fields"),
  required: z.boolean().optional().describe("Whether the field is required"),
  disabled: z.boolean().optional().describe("Whether the field is disabled"),

  // Input-specific properties
  type: z.string().optional().describe("Input type: 'text', 'email', 'password', 'tel', 'number', 'url'"),

  // Select/Radio/ToggleGroup properties
  options: z.array(OptionSchema).optional().describe("Options for Select, RadioGroup, MultiSelect, or ToggleGroup"),

  // Slider properties
  min: z.number().optional().describe("Minimum value for Slider"),
  max: z.number().optional().describe("Maximum value for Slider"),
  step: z.number().optional().describe("Step increment for Slider"),

  // Default value
  defaultValue: z.any().optional().describe("Default value for the field"),

  // Static content (for Separator)
  content: z.string().optional().describe("Content for static fields like Separator"),
});

// Tool definition for generating forms
export const generateFormDef = toolDefinition({
  name: "generate_form",
  description:
    "Update the form builder with a complete form structure. Call this after you've analyzed the user's request and generated the appropriate fields, validation rules, and metadata.",
  inputSchema: z.object({
    title: z.string().describe("Descriptive title for the form (e.g., 'Login Form', 'Contact Us Form', 'User Registration')"),
    description: z.string().describe("Brief description of the form's purpose"),
    formElements: z.array(z.object({
      id: z.string().describe("Unique identifier for the field - use UUID format"),
      fieldType: z.enum([
        "Input",
        "Textarea",
        "Checkbox",
        "RadioGroup",
        "Select",
        "MultiSelect",
        "Switch",
        "DatePicker",
        "Slider",
        "ToggleGroup",
        "Separator",
        "FileUpload",
      ]).describe("The type of form field to render"),
      name: z.string().describe("Field name attribute - use snake_case (e.g., 'email_address')"),
      label: z.string().optional().describe("Display label for the field"),
      description: z.string().optional().describe("Help text shown below the field"),
      placeholder: z.string().optional().describe("Placeholder text for input fields"),
      required: z.boolean().optional().describe("Whether the field is required"),
      disabled: z.boolean().optional().describe("Whether the field is disabled"),
      type: z.string().optional().describe("Input type: 'text', 'email', 'password', 'tel', 'number', 'url'"),
      options: z.array(z.object({
        value: z.string().describe("The value of the option"),
        label: z.string().describe("The display label for the option"),
      })).optional().describe("Options for Select, RadioGroup, MultiSelect, or ToggleGroup"),
      min: z.number().optional().describe("Minimum value for Slider"),
      max: z.number().optional().describe("Maximum value for Slider"),
      step: z.number().optional().describe("Step increment for Slider"),
      defaultValue: z.any().optional().describe("Default value for the field"),
      content: z.string().optional().describe("Content for static fields like Separator"),
    })).describe("Array of form fields you've generated."),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether the form was successfully created/updated"),
    message: z.string().describe("Confirmation message or error details"),
    fieldCount: z.number().describe("Number of fields created"),
  }),
});
