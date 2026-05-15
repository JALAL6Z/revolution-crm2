interface SiteData {
  name: string;
  category: string;
  city: string;
  phone: string;
  email: string;
  website: string;
}

const SERVICES_MAP: Record<string, [string, string][]> = {
  plombier:         [["fa-droplet","Réparation fuites"],["fa-toilet","Débouchage"],["fa-fire","Chauffe-eau"],["fa-shower","Salle de bain"],["fa-temperature-half","Chauffage"],["fa-wrench","Plomberie neuf"]],
  plomberie:        [["fa-droplet","Réparation fuites"],["fa-toilet","Débouchage"],["fa-fire","Chauffe-eau"],["fa-shower","Salle de bain"],["fa-temperature-half","Chauffage"],["fa-wrench","Plomberie neuf"]],
  electricien:      [["fa-bolt","Installation"],["fa-lightbulb","Dépannage"],["fa-plug","Tableau électrique"],["fa-house","Rénovation"],["fa-battery-full","Mise aux normes"],["fa-sliders","Domotique"]],
  electricite:      [["fa-bolt","Installation"],["fa-lightbulb","Dépannage"],["fa-plug","Tableau électrique"],["fa-house","Rénovation"],["fa-battery-full","Mise aux normes"],["fa-sliders","Domotique"]],
  restaurant:       [["fa-utensils","Restauration"],["fa-wine-glass","Bar & Boissons"],["fa-cake-candles","Événements"],["fa-clock","Service rapide"],["fa-star","Cuisine locale"],["fa-users","Groupes"]],
  cafe:             [["fa-utensils","Restauration"],["fa-wine-glass","Bar & Boissons"],["fa-cake-candles","Événements"],["fa-clock","Service rapide"],["fa-star","Cuisine locale"],["fa-users","Groupes"]],
  bar:              [["fa-utensils","Restauration"],["fa-wine-glass","Bar & Boissons"],["fa-cake-candles","Événements"],["fa-clock","Service rapide"],["fa-star","Cuisine locale"],["fa-users","Groupes"]],
  pizzeria:         [["fa-pizza-slice","Pizzas maison"],["fa-wine-glass","Boissons"],["fa-cake-candles","Événements"],["fa-motorcycle","Livraison"],["fa-star","Qualité artisanale"],["fa-users","Groupes"]],
  coiffeur:         [["fa-scissors","Coupe homme/femme"],["fa-palette","Coloration"],["fa-spa","Soin capillaire"],["fa-ring","Coiffure mariée"],["fa-star","Conseil beauté"],["fa-calendar-check","Sur RDV"]],
  coiffure:         [["fa-scissors","Coupe homme/femme"],["fa-palette","Coloration"],["fa-spa","Soin capillaire"],["fa-ring","Coiffure mariée"],["fa-star","Conseil beauté"],["fa-calendar-check","Sur RDV"]],
  salon:            [["fa-scissors","Coupe homme/femme"],["fa-palette","Coloration"],["fa-spa","Soin capillaire"],["fa-ring","Coiffure mariée"],["fa-star","Conseil beauté"],["fa-calendar-check","Sur RDV"]],
  esthetique:       [["fa-spa","Soins visage"],["fa-star","Épilation"],["fa-hand-sparkles","Manucure"],["fa-eye","Extensions cils"],["fa-moon","Soins corps"],["fa-gift","Coffrets cadeaux"]],
  beaute:           [["fa-spa","Soins visage"],["fa-star","Épilation"],["fa-hand-sparkles","Manucure"],["fa-eye","Extensions cils"],["fa-moon","Soins corps"],["fa-gift","Coffrets cadeaux"]],
  dentiste:         [["fa-tooth","Soins dentaires"],["fa-smile","Blanchiment"],["fa-bone","Implants"],["fa-child","Pédodontie"],["fa-x-ray","Radiographies"],["fa-ambulance","Urgences"]],
  medecin:          [["fa-stethoscope","Consultations"],["fa-pills","Prescriptions"],["fa-heartbeat","Suivi santé"],["fa-child","Pédiatrie"],["fa-notes-medical","Bilan santé"],["fa-clock","Téléconsultation"]],
  kine:             [["fa-dumbbell","Rééducation"],["fa-running","Sport"],["fa-person","Posture"],["fa-hands","Massage"],["fa-wheelchair","Gériatrie"],["fa-child","Pédiatrie"]],
  kinesitherapeute: [["fa-dumbbell","Rééducation"],["fa-running","Sport"],["fa-person","Posture"],["fa-hands","Massage"],["fa-wheelchair","Gériatrie"],["fa-child","Pédiatrie"]],
  avocat:           [["fa-scale-balanced","Droit civil"],["fa-house","Droit immobilier"],["fa-briefcase","Droit des affaires"],["fa-family","Droit de la famille"],["fa-file","Consultation"],["fa-shield","Confidentialité"]],
  garage:           [["fa-wrench","Révision"],["fa-tire","Pneus"],["fa-car","Carrosserie"],["fa-battery-full","Batterie"],["fa-wind","Climatisation"],["fa-clipboard-check","Contrôle technique"]],
  nettoyage:        [["fa-broom","Nettoyage bureaux"],["fa-soap","Désinfection"],["fa-spray-can","Vitres"],["fa-boxes-stacked","Débarras"],["fa-house-chimney","Fin de chantier"],["fa-calendar-check","Contrats réguliers"]],
  demenagement:     [["fa-truck","Déménagement"],["fa-boxes-stacked","Emballage"],["fa-warehouse","Garde-meuble"],["fa-clock","Express"],["fa-shield","Assurance"],["fa-calculator","Devis gratuit"]],
  jardinier:        [["fa-seedling","Entretien jardins"],["fa-tree","Taille arbres"],["fa-leaf","Pelouse"],["fa-tractor","Terrassement"],["fa-flower2","Plantations"],["fa-recycle","Évacuation déchets"]],
  jardinage:        [["fa-seedling","Entretien jardins"],["fa-tree","Taille arbres"],["fa-leaf","Pelouse"],["fa-tractor","Terrassement"],["fa-flower2","Plantations"],["fa-recycle","Évacuation déchets"]],
};

const DEFAULT_SERVICES: [string, string][] = [
  ["fa-star","Service premium"],["fa-check","Qualité garantie"],["fa-shield-halved","Expertise"],
  ["fa-clock","Rapidité"],["fa-thumbs-up","Satisfaction"],["fa-award","Excellence"],
];

function getServices(category: string): [string, string][] {
  const c = (category || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  for (const [key, svcs] of Object.entries(SERVICES_MAP)) {
    const k = key.replace(/[^a-z]/g, "");
    if (c.includes(k) || k.includes(c.slice(0, 5))) return svcs;
  }
  return DEFAULT_SERVICES;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

export function generateSiteHtml(data: SiteData): string {
  const { name, category, city, phone, email } = data;
  const cat = category || "Entreprise locale";
  const services = getServices(category);

  const serviceCards = services.map(([icon, label]) => `
        <div class="service-card">
          <div class="service-icon"><i class="fa-solid ${icon}"></i></div>
          <h3>${esc(label)}</h3>
          <p>Expertise professionnelle pour tous vos besoins en ${esc(label.toLowerCase())}.</p>
        </div>`).join("");

  const ticker = services.map(([, l]) => esc(l)).join(" &nbsp;•&nbsp; ");
  const tickerHtml = `${ticker} &nbsp;•&nbsp; ${ticker}`;

  const faqItems = [
    ["Quels sont vos délais d'intervention ?", `Nous intervenons généralement sous 24 à 48 heures selon la disponibilité et l'urgence de votre demande.`],
    ["Proposez-vous des devis gratuits ?", "Oui, tous nos devis sont gratuits et sans engagement. Contactez-nous pour obtenir une estimation rapide."],
    ["Travaillez-vous le week-end ?", "Nous sommes disponibles 6j/7. Pour les urgences, nous pouvons intervenir le dimanche sur demande."],
    ["Quelle est votre zone d'intervention ?", `Nous intervenons principalement à ${esc(city || "votre ville")} et dans un rayon de 30 km autour de la ville.`],
    ["Comment se déroule une première intervention ?", "Après votre appel ou votre message, nous convenons d'un rendez-vous. Nous établissons un diagnostic, puis un devis clair avant toute intervention."],
  ].map(([q, a]) => `
        <div class="faq-item">
          <button class="faq-q" onclick="toggleFaq(this)">
            <span>${esc(q)}</span>
            <span class="faq-arrow">▼</span>
          </button>
          <div class="faq-a"><p>${esc(a)}</p></div>
        </div>`).join("");

  const reviews = [
    [5, "Intervention rapide et professionnelle. Je recommande vivement leurs services à tous !", "Sophie M."],
    [5, "Excellent travail, équipe sérieuse et à l'écoute. Prix raisonnable et résultat impeccable.", "Marc D."],
    [4, "Très satisfaite de la prestation. Délais respectés et travail soigné. À recommander.", "Julie R."],
    [5, "Service de qualité, ponctuel et efficace. N'hésitez pas à les contacter !", "Thomas B."],
  ].map(([stars, text, author]) => `
        <div class="review-card">
          <div class="review-stars">${"★".repeat(Number(stars))}${"☆".repeat(5 - Number(stars))}</div>
          <p>"${esc(String(text))}"</p>
          <div class="reviewer">— ${esc(String(author))}</div>
        </div>`).join("");

  const contactInfo = [
    phone ? `<div class="contact-item"><i class="fa-solid fa-phone"></i><span>${esc(phone)}</span></div>` : "",
    email ? `<div class="contact-item"><i class="fa-solid fa-envelope"></i><span>${esc(email)}</span></div>` : "",
    city ? `<div class="contact-item"><i class="fa-solid fa-location-dot"></i><span>${esc(city)}</span></div>` : "",
  ].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(name)} — ${esc(cat)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
  <style>
    :root {
      --purple: #7C3AED;
      --purple-light: #8B5CF6;
      --purple-dark: #6D28D9;
      --purple-bg: rgba(124,58,237,0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; color: #111; background: #fff; }

    /* NAV */
    nav {
      position: sticky; top: 0; background: #fff; z-index: 100;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 8px rgba(0,0,0,0.06);
    }
    .nav-inner {
      max-width: 1200px; margin: 0 auto; padding: 0 24px;
      display: flex; align-items: center; justify-content: space-between; height: 68px;
    }
    .nav-logo { font-size: 20px; font-weight: 800; color: var(--purple); }
    .nav-links { display: flex; gap: 32px; list-style: none; }
    .nav-links a { text-decoration: none; color: #374151; font-weight: 500; font-size: 15px; transition: color .15s; }
    .nav-links a:hover { color: var(--purple); }
    .nav-cta {
      background: var(--purple); color: #fff; border: none; border-radius: 8px;
      padding: 10px 20px; font-weight: 600; font-size: 14px; cursor: pointer;
      text-decoration: none; transition: background .15s;
    }
    .nav-cta:hover { background: var(--purple-dark); }

    /* HERO */
    .hero {
      background: linear-gradient(135deg, #1e1040 0%, #2d1b69 50%, #1a0a3c 100%);
      color: #fff; padding: 100px 24px 80px; text-align: center; position: relative; overflow: hidden;
    }
    .hero::before {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse at 60% 50%, rgba(124,58,237,0.4) 0%, transparent 70%);
    }
    .hero-inner { max-width: 800px; margin: 0 auto; position: relative; z-index: 1; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(124,58,237,0.3); border: 1px solid rgba(124,58,237,0.5);
      border-radius: 20px; padding: 6px 16px; font-size: 13px; font-weight: 600;
      color: #c4b5fd; margin-bottom: 24px;
    }
    .hero h1 {
      font-size: clamp(32px, 6vw, 60px); font-weight: 900; line-height: 1.1;
      margin-bottom: 16px;
    }
    .hero h1 span { color: #a78bfa; }
    .hero p { font-size: 18px; color: #c4b5fd; margin-bottom: 36px; max-width: 560px; margin-left: auto; margin-right: auto; }
    .hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn-hero-primary {
      background: var(--purple); color: #fff; padding: 16px 32px; border-radius: 10px;
      font-weight: 700; font-size: 16px; text-decoration: none; border: none; cursor: pointer;
      transition: all .2s; display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-hero-primary:hover { background: var(--purple-light); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(124,58,237,0.5); }
    .btn-hero-secondary {
      background: rgba(255,255,255,0.1); color: #fff; padding: 16px 32px; border-radius: 10px;
      font-weight: 600; font-size: 16px; text-decoration: none; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;
      transition: all .2s;
    }
    .btn-hero-secondary:hover { background: rgba(255,255,255,0.2); }

    /* TICKER */
    .ticker { background: var(--purple); color: #fff; padding: 12px 0; overflow: hidden; white-space: nowrap; }
    .ticker-track { display: inline-block; animation: ticker 20s linear infinite; font-size: 14px; font-weight: 500; }
    @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

    /* SECTIONS */
    .section { padding: 80px 24px; }
    .section-inner { max-width: 1200px; margin: 0 auto; }
    .section-label { font-size: 13px; font-weight: 700; color: var(--purple); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .section-title { font-size: clamp(24px, 4vw, 40px); font-weight: 800; line-height: 1.2; margin-bottom: 16px; }
    .section-sub { font-size: 17px; color: #6b7280; max-width: 540px; }
    .section-alt { background: #f9fafb; }

    /* SERVICE CARDS */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 48px; }
    .service-card {
      background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px;
      transition: all .2s;
    }
    .service-card:hover { border-color: var(--purple); box-shadow: 0 8px 30px rgba(124,58,237,0.1); transform: translateY(-4px); }
    .service-icon {
      width: 52px; height: 52px; background: var(--purple-bg); border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; color: var(--purple); margin-bottom: 16px;
    }
    .service-card h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
    .service-card p { font-size: 14px; color: #6b7280; line-height: 1.6; }

    /* STATS */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-top: 48px; }
    .stat-card {
      text-align: center; background: linear-gradient(135deg, var(--purple-bg), rgba(124,58,237,0.04));
      border: 1px solid rgba(124,58,237,0.2); border-radius: 16px; padding: 32px 20px;
    }
    .stat-number { font-size: 48px; font-weight: 900; color: var(--purple); line-height: 1; margin-bottom: 8px; }
    .stat-label { font-size: 15px; color: #374151; font-weight: 500; }

    /* PROCESS */
    .process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 32px; margin-top: 48px; }
    .process-step { text-align: center; }
    .step-number {
      width: 56px; height: 56px; background: var(--purple); color: #fff;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 800; margin: 0 auto 20px;
    }
    .process-step h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    .process-step p { font-size: 14px; color: #6b7280; line-height: 1.6; }

    /* REVIEWS */
    .reviews-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-top: 48px; }
    .review-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; }
    .review-stars { color: #f59e0b; font-size: 20px; margin-bottom: 12px; }
    .review-card p { font-size: 14px; color: #374151; line-height: 1.7; margin-bottom: 12px; font-style: italic; }
    .reviewer { font-size: 13px; font-weight: 600; color: var(--purple); }

    /* FAQ */
    .faq-list { margin-top: 48px; display: grid; gap: 12px; max-width: 760px; margin-left: auto; margin-right: auto; }
    .faq-item { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
    .faq-q {
      width: 100%; background: #fff; border: none; padding: 18px 20px;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 15px; font-weight: 600; cursor: pointer; text-align: left;
      transition: background .15s; font-family: inherit;
    }
    .faq-q:hover { background: var(--purple-bg); }
    .faq-arrow { color: var(--purple); transition: transform .2s; font-size: 12px; flex-shrink: 0; margin-left: 12px; }
    .faq-a { display: none; padding: 0 20px 18px; background: #fafafa; }
    .faq-a p { font-size: 14px; color: #6b7280; line-height: 1.7; }
    .faq-a.open { display: block; }

    /* CONTACT */
    .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 48px; }
    @media (max-width: 700px) { .contact-grid { grid-template-columns: 1fr; } }
    .contact-form { display: grid; gap: 14px; }
    .form-inp {
      width: 100%; padding: 13px 16px; border: 1px solid #e5e7eb; border-radius: 10px;
      font-size: 14px; font-family: inherit; outline: none; transition: border-color .15s;
    }
    .form-inp:focus { border-color: var(--purple); box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
    .form-btn {
      background: var(--purple); color: #fff; border: none; border-radius: 10px;
      padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer;
      transition: background .15s; font-family: inherit;
    }
    .form-btn:hover { background: var(--purple-dark); }
    .contact-item {
      display: flex; align-items: center; gap: 14px; padding: 16px;
      background: var(--purple-bg); border-radius: 12px; margin-bottom: 12px;
      font-size: 15px;
    }
    .contact-item i { color: var(--purple); font-size: 18px; width: 22px; text-align: center; }

    /* FOOTER */
    footer {
      background: #0f0f0f; color: #9ca3af; padding: 40px 24px;
      text-align: center; font-size: 13px; line-height: 1.8;
    }
    footer strong { color: #8B5CF6; }
    footer a { color: #a78bfa; }

    /* MAQUETTE BANNER */
    .maquette-banner {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: linear-gradient(135deg, var(--purple), var(--purple-dark));
      color: #fff; text-align: center; padding: 12px 20px;
      font-size: 14px; font-weight: 600; z-index: 9999;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .maquette-banner button {
      background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4);
      color: #fff; border-radius: 6px; padding: 4px 12px; cursor: pointer;
      font-size: 12px; font-weight: 600;
    }
    .maquette-banner button:hover { background: rgba(255,255,255,0.35); }

    @media (max-width: 768px) {
      .nav-links { display: none; }
    }
  </style>
</head>
<body>

<!-- MAQUETTE BANNER -->
<div class="maquette-banner">
  ✨ Maquette exclusive — Créée par Revolution Agency pour ${esc(name)}
  <button onclick="this.parentElement.style.display='none'">Fermer</button>
</div>

<!-- NAV -->
<nav>
  <div class="nav-inner">
    <div class="nav-logo">${esc(name)}</div>
    <ul class="nav-links">
      <li><a href="#services">Services</a></li>
      <li><a href="#process">Comment ça marche</a></li>
      <li><a href="#avis">Avis clients</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
    ${phone ? `<a href="tel:${esc(phone)}" class="nav-cta">📞 ${esc(phone)}</a>` : `<a href="#contact" class="nav-cta">Nous contacter</a>`}
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-inner">
    <div class="hero-badge">✨ Maquette exclusive — Revolution Agency</div>
    <h1>${esc(name)}<br/><span>${esc(cat)}</span></h1>
    <p>Votre expert local${city ? ` à ${esc(city)}` : ""}. Qualité, rapidité et satisfaction garanties.</p>
    <div class="hero-btns">
      ${phone ? `<a href="tel:${esc(phone)}" class="btn-hero-primary"><i class="fa-solid fa-phone"></i> Appeler maintenant</a>` : ""}
      <a href="#contact" class="${phone ? "btn-hero-secondary" : "btn-hero-primary"}">Prendre contact</a>
      <a href="#services" class="btn-hero-secondary">Nos services</a>
    </div>
  </div>
</section>

<!-- TICKER -->
<div class="ticker">
  <div class="ticker-track">${tickerHtml}</div>
</div>

<!-- SERVICES -->
<section class="section" id="services">
  <div class="section-inner">
    <div class="section-label">Ce que nous faisons</div>
    <div class="section-title">Nos services</div>
    <div class="section-sub">Des prestations professionnelles adaptées à vos besoins.</div>
    <div class="services-grid">${serviceCards}</div>
  </div>
</section>

<!-- STATS -->
<section class="section section-alt">
  <div class="section-inner">
    <div style="text-align:center;margin-bottom:0;">
      <div class="section-label" style="justify-content:center;display:flex;">Chiffres clés</div>
      <div class="section-title" style="text-align:center;">Notre expertise en chiffres</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">12+</div><div class="stat-label">Années d'expérience</div></div>
      <div class="stat-card"><div class="stat-number">850+</div><div class="stat-label">Clients satisfaits</div></div>
      <div class="stat-card"><div class="stat-number">1 200+</div><div class="stat-label">Interventions réalisées</div></div>
      <div class="stat-card"><div class="stat-number">98%</div><div class="stat-label">Taux de satisfaction</div></div>
    </div>
  </div>
</section>

<!-- PROCESS -->
<section class="section" id="process">
  <div class="section-inner">
    <div class="section-label">Notre méthode</div>
    <div class="section-title">Comment ça marche ?</div>
    <div class="section-sub">Un processus simple et transparent en 3 étapes.</div>
    <div class="process-grid">
      <div class="process-step">
        <div class="step-number">1</div>
        <h3>Prise de contact</h3>
        <p>Appelez-nous ou envoyez un message. Nous répondons sous 2 heures en moyenne.</p>
      </div>
      <div class="process-step">
        <div class="step-number">2</div>
        <h3>Devis gratuit</h3>
        <p>Nous établissons un devis clair, sans surprise, adapté à votre situation.</p>
      </div>
      <div class="process-step">
        <div class="step-number">3</div>
        <h3>Intervention</h3>
        <p>Notre équipe intervient rapidement avec le matériel adapté à votre besoin.</p>
      </div>
    </div>
  </div>
</section>

<!-- REVIEWS -->
<section class="section section-alt" id="avis">
  <div class="section-inner">
    <div class="section-label">Ce qu'ils disent</div>
    <div class="section-title">Avis de nos clients</div>
    <div class="reviews-grid">${reviews}</div>
  </div>
</section>

<!-- FAQ -->
<section class="section">
  <div class="section-inner">
    <div style="text-align:center;margin-bottom:0;">
      <div class="section-label" style="justify-content:center;display:flex;">FAQ</div>
      <div class="section-title" style="text-align:center;">Questions fréquentes</div>
    </div>
    <div class="faq-list">${faqItems}</div>
  </div>
</section>

<!-- CONTACT -->
<section class="section section-alt" id="contact">
  <div class="section-inner">
    <div class="section-label">Nous joindre</div>
    <div class="section-title">Contactez-nous</div>
    <div class="contact-grid">
      <div>
        <div class="contact-info">${contactInfo}</div>
      </div>
      <div>
        <form class="contact-form" onsubmit="handleFormSubmit(event)">
          <input type="text" class="form-inp" placeholder="Votre nom" required/>
          <input type="tel" class="form-inp" placeholder="Votre téléphone" required/>
          <input type="email" class="form-inp" placeholder="Votre email"/>
          <textarea class="form-inp" rows="4" placeholder="Votre message..." style="resize:vertical;"></textarea>
          <button type="submit" class="form-btn">Envoyer le message</button>
        </form>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <strong>${esc(name)}</strong> — ${esc(cat)}<br/>
  ${city ? `${esc(city)}<br/><br/>` : ""}
  Maquette réalisée par <strong>Revolution Agency</strong> — Agence SMMA & Stratégie Digitale<br/>
  <a href="mailto:contact@revolution-ecom.com">contact@revolution-ecom.com</a>
</footer>

<script>
function toggleFaq(btn) {
  var answer = btn.nextElementSibling;
  var arrow = btn.querySelector('.faq-arrow');
  answer.classList.toggle('open');
  arrow.style.transform = answer.classList.contains('open') ? 'rotate(180deg)' : '';
}
function handleFormSubmit(e) {
  e.preventDefault();
  var btn = e.target.querySelector('button[type=submit]');
  btn.textContent = 'Message envoyé !';
  btn.style.background = '#16a34a';
  setTimeout(function() { btn.textContent = 'Envoyer le message'; btn.style.background = ''; }, 3000);
}
</script>
</body>
</html>`;
}
