import { useMemo } from "react";
import { MODELS, PROVIDERS, modelKey } from "../lib/catalog.js";
import { useStored } from "./useStored.js";

// Built-in providers/models merged with the ones the user added, plus the
// list of models the user switched off.
export function useCatalog() {
  const [customProviders, setCustomProviders] = useStored("customProviders", []);
  const [customModels, setCustomModels] = useStored("customModels", []);
  const [hidden, setHidden] = useStored("hiddenModels", []);

  return useMemo(() => {
    const providers = [...PROVIDERS, ...customProviders.map((p) => ({ ...p, type: "openai", custom: true }))];
    const models = [...MODELS, ...customModels.map((m) => ({ ...m, custom: true }))].filter((m) =>
      providers.some((p) => p.id === m.provider)
    );
    const enabled = models.filter((m) => !hidden.includes(modelKey(m)));

    return {
      providers,
      models,
      enabled,
      hidden,
      providerById: (id) => providers.find((p) => p.id === id),
      toggleModel: (key) => setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key])),
      addModel: (m) => {
        setCustomModels((list) => (list.some((x) => modelKey(x) === modelKey(m)) ? list : [...list, m]));
        setHidden((h) => h.filter((k) => k !== modelKey(m)));
      },
      removeModel: (key) => setCustomModels((list) => list.filter((m) => modelKey(m) !== key)),
      addProvider: ({ name, baseUrl }) => {
        const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
        setCustomProviders((list) => [...list, { id, name, baseUrl }]);
        return id;
      },
      removeProvider: (id) => {
        setCustomProviders((list) => list.filter((p) => p.id !== id));
        setCustomModels((list) => list.filter((m) => m.provider !== id));
      },
    };
  }, [customProviders, customModels, hidden, setCustomProviders, setCustomModels, setHidden]);
}
