This code has two access modes to subagents: using a CLI tool and via API;

this is too much to maintain;

(a) [ ] remove all API-based access code, and leave access only via the respective CLI tools
(b) [ ] add the capability to configure EVERYTHING via a user-specific configuration file, e.g. living in ~/.config/grey-so/config.json; this is to remove any dependency on environment variables which might or might not be set; move all settable settings to there

(c) [ ] robustify the model naming. Instead of requiring the exact model name from the caller, only introduce 4 aliases: `gemini`, `claude`, `codex` and `kilo` ; the exact model names for all of them are to be looked up from the configuration file only, and no need to discuss that with the caller. This also means that you can replace "startswith" with exact match, and error on incorrect parameter.
(d) [ ] This also means that there is never any need for a "fallback model" - if given CLI does not respond correctly, do not try any fallbacks, just propagate error to the client.

(e) [ ] remove any logic related to calculating the costs of work. It is not needed anymore as we are using subscriptions anyway.
(f) [ ] short-circuit "isCliExecution" as we always only ever have CLI execution
(g) [ ] with "kilo code" (bash: kilo ) instead of "kilocode-default" always specify model as per configuration file, and that's a default of "openrouter/moonshotai/kimi-k2.5"