import { useEffect, useState } from "react";
import type { Provider, SettingsResponse } from "@qelvra/shared";
import { ApiError, getSettings, listProviders, refreshProviders } from "../../lib/api";

const panel =
  "min-w-0 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:p-6";
const button =
  "rounded-lg px-4 py-2 text-body-md font-medium bg-primary text-on-primary hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
const reason: Record<NonNullable<Provider["reason"]>, string> = {
  CLI_NOT_FOUND: "CLI not found",
  DETECTION_FAILED: "Detection failed",
  AUTH_REQUIRED: "CLI sign-in required",
  CONFIGURATION_REQUIRED: "Provider configuration required",
  DISABLED_IN_PRODUCTION: "Disabled in production",
};
const auth: Record<Provider["auth"], string> = {
  authenticated: "Authenticated",
  "auth-required": "Sign-in required",
  unknown: "Unknown",
  "not-required": "Not required",
};
const errorText = (error: unknown) =>
  error instanceof ApiError
    ? `${error.message} (${error.code ?? error.kind})`
    : "The server could not be reached. Retry when it is available.";

function Values({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2 mt-5">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-body-md text-on-surface-variant">{label}</dt>
          <dd className="mt-1 font-code-md text-code-md text-on-surface break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsAttempt, setSettingsAttempt] = useState(0);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerBusy, setProviderBusy] = useState(true);
  const [providerAttempt, setProviderAttempt] = useState(0);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setSettingsError(null);
      try {
        const result = await getSettings({ signal: controller.signal });
        if (!controller.signal.aborted) setSettings(result);
      } catch (error) {
        if (!controller.signal.aborted) setSettingsError(errorText(error));
      }
    });
    return () => controller.abort();
  }, [settingsAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setProviderBusy(true);
      setProviderError(null);
      setRefreshed(false);
      try {
        const load = providerAttempt === 0 ? listProviders : refreshProviders;
        const result = await load({ signal: controller.signal });
        if (!controller.signal.aborted) {
          setProviders(result);
          setRefreshed(providerAttempt > 0);
        }
      } catch (error) {
        if (!controller.signal.aborted) setProviderError(errorText(error));
      } finally {
        if (!controller.signal.aborted) setProviderBusy(false);
      }
    });
    return () => controller.abort();
  }, [providerAttempt]);

  function rediscover() {
    setProviderBusy(true);
    setProviderAttempt((attempt) => attempt + 1);
  }

  return (
    <main className="pt-12 min-h-screen bg-background text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Settings</h1>
          <p className="mt-2 text-body-md text-on-surface-variant max-w-prose">
            Effective server configuration and locally discovered providers. Configuration is
            read-only; change server startup values and restart Qelvra to apply changes.
          </p>
        </header>

        <section className={panel} aria-label="General">
          <h2 className="font-headline-md text-headline-md text-on-surface">General</h2>
          {settings ? (
            <Values
              rows={[
                ["Qelvra version", settings.general.version],
                ["Environment", settings.general.environment],
                ["Server Node version", settings.general.nodeVersion],
                [
                  "Platform / architecture",
                  `${settings.general.platform} / ${settings.general.architecture}`,
                ],
              ]}
            />
          ) : settingsError ? (
            <div role="alert" className="mt-4 text-body-md text-error">
              <p>Settings could not be loaded. {settingsError}</p>
              <button
                className={`${button} mt-3`}
                onClick={() => setSettingsAttempt((attempt) => attempt + 1)}
              >
                Retry settings
              </button>
            </div>
          ) : (
            <p role="status" className="mt-4 text-body-md text-on-surface-variant">
              Loading effective configuration…
            </p>
          )}
        </section>

        <section className={panel} aria-label="Providers" aria-busy={providerBusy}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-headline-md text-headline-md text-on-surface">Providers</h2>
            <button className={button} disabled={providerBusy} onClick={rediscover}>
              {providerBusy && providerAttempt > 0
                ? "Refreshing providers…"
                : providers === null && providerError
                  ? "Retry providers"
                  : "Refresh providers"}
            </button>
          </div>
          <p className="mt-2 text-body-md text-on-surface-variant max-w-prose">
            Discovery checks local provider CLIs. Refresh reruns detection using the server’s
            current PATH. After changing PATH, restart Qelvra first. Sign in through the provider’s
            own CLI.
          </p>
          {providerError && (
            <p role="alert" className="mt-4 text-body-md text-error">
              {providers === null
                ? "Providers could not be loaded."
                : "Provider refresh failed. Showing the last known provider snapshot."}{" "}
              {providerError}
            </p>
          )}
          {providerBusy && (
            <p role="status" className="mt-4 text-body-md text-on-surface-variant">
              {providerAttempt > 0
                ? "Checking locally installed providers…"
                : "Loading provider discovery…"}
            </p>
          )}
          {refreshed && (
            <p role="status" className="mt-4 text-body-md text-tertiary">
              Providers refreshed.
            </p>
          )}
          {providers !== null &&
            (providers.length === 0 ? (
              <p className="mt-4 text-body-md text-on-surface-variant">
                No providers were returned by discovery.
              </p>
            ) : (
              <div
                className="mt-5 overflow-x-auto"
                tabIndex={0}
                aria-label="Scrollable provider status table"
              >
                <table className="w-full min-w-[640px] text-left text-body-md">
                  <caption className="sr-only">
                    Discovered provider status and automation support
                  </caption>
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                      {["Provider", "Availability", "Version", "Authentication", "Automation"].map(
                        (label) => (
                          <th scope="col" className="pb-3 pr-4 font-medium" key={label}>
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((provider) => (
                      <tr key={provider.id} className="border-b border-outline-variant/20">
                        <th scope="row" className="py-4 pr-4 font-medium text-on-surface">
                          {provider.name}
                        </th>
                        <td className="py-4 pr-4 text-on-surface">
                          <span>{provider.available ? "Available" : "Unavailable"}</span>
                          {provider.reason && (
                            <span className="block mt-1 text-body-sm text-on-surface-variant">
                              {reason[provider.reason]}
                            </span>
                          )}
                        </td>
                        <td className="py-4 pr-4 font-code-md text-code-md">
                          {provider.version ?? "Not reported"}
                        </td>
                        <td className="py-4 pr-4">{auth[provider.auth]}</td>
                        <td className="py-4">
                          {provider.capabilities.automation ? "Supported" : "Not supported"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          <p className="mt-4 text-body-sm text-on-surface-variant max-w-prose">
            Automated execution also requires an available, configured provider and any required CLI
            authentication. Fake is a development provider and is disabled in production.
          </p>
        </section>

        {settings && (
          <>
            <section className={panel} aria-label="Storage">
              <h2 className="font-headline-md text-headline-md text-on-surface">Storage</h2>
              <Values
                rows={[
                  ["DATA_DIR", settings.storage.dataDir],
                  ["Workspace root", settings.storage.workspaceRoot],
                ]}
              />
              <p className="mt-5 text-body-md text-on-surface-variant max-w-prose">
                These paths are resolved by the server at startup. The workspace root is for
                developer scratch shells; agents use isolated managed workspaces within DATA_DIR.
                Changing paths requires a server restart and does not move existing data.
              </p>
            </section>
            <section className={panel} aria-label="Network and Security">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Network &amp; Security
              </h2>
              <Values
                rows={[
                  ["API host", settings.network.host],
                  ["API port", String(settings.network.port)],
                  ["Loopback-only binding", settings.network.loopbackOnly ? "Yes" : "No"],
                  ["API authentication", "Not enabled"],
                ]}
              />
              <div className="mt-5">
                <h3 className="text-body-md font-medium text-on-surface-variant">
                  Allowed web origins
                </h3>
                <ul className="mt-1 space-y-1 font-code-md text-code-md text-on-surface break-all">
                  {settings.network.webOrigins.map((origin) => (
                    <li key={origin}>{origin}</li>
                  ))}
                </ul>
              </div>
              {!settings.network.loopbackOnly && (
                <p role="alert" className="mt-5 text-body-md text-error max-w-prose">
                  Non-loopback exposure: Qelvra’s API has no authentication. Do not expose it to
                  untrusted networks or the public internet.
                </p>
              )}
              <p className="mt-5 text-body-md text-on-surface-variant max-w-prose">
                Host, port and web origins are startup configuration and require a server restart to
                change. Browser origin and Host checks are protections, not API authentication.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
