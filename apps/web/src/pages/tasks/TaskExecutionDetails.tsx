import type { TaskExecutionResponse } from "@qelvra/shared";
const ERRORS: Record<string, string> = {
  EXECUTION_TIMED_OUT: "Execution timed out. The task is ready to retry.",
  EXECUTION_CANCELLED:
    "Execution cancelled. Workspace edits may remain; the task is ready to retry.",
  EXECUTION_INTERRUPTED: "Execution interrupted. Execute again to retry.",
  EXECUTION_INVALID_RESULT: "Invalid result format. The task is ready to retry.",
  EXECUTION_AGENT_FAILED: "The agent returned a failure. Review its notes and retry.",
  EXECUTION_OUTPUT_LIMIT: "Provider output exceeded the allowed size. The task is ready to retry.",
  PROVIDER_AUTH_REQUIRED: "Provider authentication required. Sign in using its CLI, then retry.",
};
export function TaskExecutionDetails({
  execution,
  result,
  active,
  providerName,
}: TaskExecutionResponse & { active: boolean; providerName: string }) {
  if (!execution) return null;
  return (
    <section
      aria-label="Task execution"
      className="flex flex-col gap-3 font-body-sm text-body-sm text-on-surface-variant"
    >
      <h3 className="font-headline-sm text-headline-sm text-on-surface">
        {active ? "Agent working" : result ? "Execution result" : "Execution"}
      </h3>
      <dl className="flex flex-col gap-2">
        <div>
          <dt className="text-outline">Provider</dt>
          <dd>{providerName}</dd>
        </div>
        <div>
          <dt className="text-outline">State</dt>
          <dd role="status">
            {active
              ? "Running"
              : execution.status === "succeeded"
                ? "Ready for review"
                : execution.status}
          </dd>
        </div>
        <div>
          <dt className="text-outline">Started</dt>
          <dd>
            <time dateTime={execution.startedAt}>
              {new Date(execution.startedAt).toLocaleString()}
            </time>
          </dd>
        </div>
      </dl>
      {execution.errorCode && (
        <p role="alert" className="text-error">
          {ERRORS[execution.errorCode] ??
            "Execution failed. Check provider availability and retry."}
        </p>
      )}
      {result && (
        <>
          <h4 className="font-medium text-on-surface">Summary</h4>
          <p className="whitespace-pre-wrap break-words">{result.summary}</p>
          <h4 className="font-medium text-on-surface">Reported changed files</h4>
          {result.changedFiles.length ? (
            <ul className="list-disc pl-5 font-code-sm text-code-sm break-all">
              {result.changedFiles.map((file, index) => (
                <li key={`${file}-${index}`}>{file}</li>
              ))}
            </ul>
          ) : (
            <p>No changed files reported.</p>
          )}
          {result.notes && (
            <>
              <h4 className="font-medium text-on-surface">Notes</h4>
              <p className="whitespace-pre-wrap break-words">{result.notes}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
