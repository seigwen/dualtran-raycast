/**
 * The unconfigured-aware shape of the AI settings controls (SPEC 2.1).
 *
 * One projection is shared by the three surfaces that show AI settings — the
 * manifest `aiProvider` dropdown, the Choose AI Provider List and the
 * conformance payload — so the empty state cannot drift between them:
 *
 *   provider   ONE alphabetical list of real providers; while unconfigured the
 *              picker also shows a DISABLED, SELECTED placeholder with an
 *              empty value that is not part of `options` and never sorted.
 *   model      empty and disabled until a provider exists (label points at
 *              the provider picker).
 *   endpoint   "" with the `https://` placeholder until a provider is chosen;
 *              then the provider API as the VALUE, unless the user typed one.
 *   reasoning  disabled while unconfigured, but its stored sentinel stays.
 */
import { t } from "../i18n";
import { isProviderUnconfigured } from "./preferences";

/** The empty selection; never a real provider, never selectable. */
export const PROVIDER_PLACEHOLDER = { value: "", disabled: true } as const;

/**
 * The host's custom provider id (a user-defined OpenAI-compatible endpoint).
 * Raycast has none of its own, so nothing is appended to the merged list; the
 * projection still sorts it last if a future build adds one.
 */
export const CUSTOM_PROVIDER_ID = "__custom_provider__";

/** Placeholder for the endpoint input while nothing is chosen. */
export const ENDPOINT_PLACEHOLDER = "https://";

export interface ProviderLike {
  id: string;
  name: string;
  api: string;
  /** `buildProviderList` marks catalogue-only entries `builtIn: false`. */
  builtIn?: boolean;
}

export interface AiSettingsInput {
  /** Stored preference/override value; "" means "not chosen yet". */
  current: string;
  /** Real providers, already merged and alphabetical (built-ins + models.dev). */
  providers: ProviderLike[];
  /** Stored model id (only meaningful with a provider). */
  model?: string;
  /** Stored endpoint override ("" when untouched). */
  endpoint?: string;
  /** Stored reasoning level; the sentinel is preserved while disabled. */
  reasoning?: string;
  /**
   * Provider source for the conformance payload. Defaults to the provider's own
   * origin: a custom provider is the host's last entry, built-ins and the
   * models.dev catalogue are told apart by `builtIn`.
   */
  sourceOf?: (provider: ProviderLike) => "built-in" | "models.dev" | "custom";
}

export interface AiSettingsView {
  provider: {
    control: "select";
    current: string;
    placeholder: { value: string; label: string; disabled: true; selected: boolean };
    fallback: "";
    options: { value: string; label: string; source: "built-in" | "models.dev" | "custom" }[];
  };
  model: {
    control: "select";
    disabled: boolean;
    selectedProvider: string;
    selectedModel: string;
    label: string;
    placeholder: string;
    options: { value: string; label: string }[];
  };
  endpoint: { control: "input"; current: string; placeholder: string };
  reasoning: { control: "select"; disabled: boolean; default: string };
}

/** One alphabetical list; a custom provider is pinned to the end. */
function sortedOptions(providers: ProviderLike[]): ProviderLike[] {
  const compare = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  const regular = providers.filter((provider) => provider.id !== CUSTOM_PROVIDER_ID);
  const custom = providers.filter((provider) => provider.id === CUSTOM_PROVIDER_ID);
  return [...regular].sort((a, b) => compare.compare(a.name, b.name) || a.id.localeCompare(b.id)).concat(custom);
}

function defaultProviderSource(provider: ProviderLike): "built-in" | "models.dev" | "custom" {
  if (provider.id === CUSTOM_PROVIDER_ID) return "custom";
  return provider.builtIn === false ? "models.dev" : "built-in";
}

export function buildAiSettingsView(input: AiSettingsInput): AiSettingsView {
  const current = typeof input.current === "string" ? input.current.trim() : "";
  const unconfigured = isProviderUnconfigured(current);
  const selected = input.providers.find((provider) => provider.id === current);
  const sourceOf = input.sourceOf ?? defaultProviderSource;

  return {
    provider: {
      control: "select",
      current,
      placeholder: {
        value: PROVIDER_PLACEHOLDER.value,
        label: t("providerPlaceholder"),
        disabled: true,
        selected: unconfigured,
      },
      // Never a silent provider: an unconfigured state has no fallback at all.
      fallback: "",
      // Real providers only: the placeholder is not part of this list and is
      // never sorted with it; a custom provider stays last.
      options: sortedOptions(input.providers).map((provider) => ({
        value: provider.id,
        label: provider.name,
        source: sourceOf(provider),
      })),
    },
    model: {
      control: "select",
      disabled: unconfigured,
      selectedProvider: unconfigured ? "" : current,
      selectedModel: unconfigured ? "" : (input.model ?? ""),
      label: unconfigured ? t("providerRequiredForModel") : "",
      placeholder: unconfigured ? t("providerRequiredForModel") : "",
      options: [],
    },
    endpoint: {
      control: "input",
      current: unconfigured ? "" : input.endpoint || (selected && selected.api) || "",
      placeholder: unconfigured ? ENDPOINT_PLACEHOLDER : (selected && selected.api) || ENDPOINT_PLACEHOLDER,
    },
    reasoning: {
      control: "select",
      disabled: unconfigured,
      // The sentinel survives the empty state: disabling never rewrites it.
      default: input.reasoning || "lowest",
    },
  };
}

/**
 * Endpoint VALUE after the user picks a provider: the provider API, unless the
 * user already typed an endpoint (then it is theirs and stays).
 */
export function resolveProviderChoice(
  endpoint: { currentEndpoint: string; endpointPlaceholder: string },
  provider: ProviderLike | null,
): { endpoint: string } | null {
  if (!provider || isProviderUnconfigured(provider.id)) return null;
  const typed = typeof endpoint.currentEndpoint === "string" ? endpoint.currentEndpoint.trim() : "";
  // The endpoint still equal to the previous placeholder/autofill is untouched.
  return { endpoint: typed === "" ? provider.api : typed };
}

/** The localized guard message every AI entry point shows when no provider is set. */
export function providerRequiredMessage(): string {
  return t("providerRequiredError");
}

/**
 * The same message with the unconfigured provider named, for thrown errors:
 * `provider: ""` alone is not a diagnosis the user can act on.
 */
export function providerRequiredErrorFor(provider: unknown): Error {
  const detail = typeof provider === "string" ? JSON.stringify(provider) : String(provider);
  return new Error(`${providerRequiredMessage()} (provider: ${detail})`);
}

/**
 * Whether this translation needs a provider that is missing: only the AI
 * engine does. Google needs no provider, so the empty state never blocks it.
 */
export function requiresProvider(settings: { engine: string; aiProvider: string }): boolean {
  return settings.engine === "ai" && isProviderUnconfigured(settings.aiProvider);
}
