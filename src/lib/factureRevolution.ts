export interface FactureServiceLine {
  name: string;
  detail: string;
  amount: number;
  discount?: number;
  total?: number;
}

export interface FacturePayload {
  client: string;
  siret?: string;
  form?: string;
  address: string;
  num: string;
  services: FactureServiceLine[];
}

const shellQuote = (value: string) => `'${String(value).replace(/'/g, "'\\''")}'`;

export function buildFactureCommand(payload: FacturePayload) {
  const base = [
    "python3",
    "~/.local/bin/facture.py",
    "--client", shellQuote(payload.client),
    "--siret", shellQuote(payload.siret ?? ""),
    "--form", shellQuote(payload.form ?? ""),
    "--address", shellQuote(payload.address),
    "--num", shellQuote(payload.num),
  ];

  const services = payload.services.flatMap((service) => {
    const amount = Number(service.amount || 0);
    const discount = Number(service.discount || 0);
    const total = Number(service.total ?? amount - discount);
    return ["--service", shellQuote(`${service.name}|${service.detail}|${amount}|${discount || "-"}|${total}`)];
  });

  return [...base, ...services].join(" ");
}

export function detailFromDescription(description?: string | null) {
  const text = description?.trim();
  if (text) return text.replace(/\n+/g, " · ");
  return "Cadrage stratégique · Production et exécution · Suivi projet · Optimisations · Reporting";
}
