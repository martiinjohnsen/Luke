import { ISSUE_SCOPE,type DoorIssues } from "@/lib/door-validation";

export function validationAttributes(issues: DoorIssues, field: string) {
  return {
    "data-validation-field": `${issues[ISSUE_SCOPE] ?? ""}${field}`,
    "aria-invalid": Boolean(issues[field]),
    "aria-describedby": issues[field] ? `${issues[ISSUE_SCOPE] ?? ""}${field}-error` : undefined,
  };
}

export function FieldError({ issues, field }: { issues: DoorIssues; field: string }) {
  return issues[field]
    ? <p className="field-error" id={`${issues[ISSUE_SCOPE] ?? ""}${field}-error`}>{issues[field]}</p>
    : null;
}
