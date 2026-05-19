// Normalise secteur + détecte ville depuis le nom d'entreprise
// Utilisé à l'import (Google Sheets, CSV) et sur les prospects existants

const ICP_MAP: { id: string; label: string; keywords: string[] }[] = [
  { id: "restaurant",   label: "restaurant",     keywords: ["restaurant","brasserie","pizzeria","traiteur","cafe","bar","bistrot","creperie","sushi","kebab","burger","snack","fast food","bouche","boulangerie","patisserie","boucher","boulanger","roti","grill","tapas","wok","ramen","thai","indien","libanais","gastronomique","bouchon","taverne","auberge","cantine","self","buffet"] },
  { id: "plomberie",    label: "plomberie",      keywords: ["plombier","plomberie","chauffagiste","chauffage","sanitaire","chaudiere","climatisation","pompe a chaleur","pac","debouchage","canalisation","chauffage","thermique","depannage plomb","urgence plomb"] },
  { id: "electricite",  label: "electricite",    keywords: ["electricien","electricite","electrique","domotique","tableau electrique","panneau solaire","photovoltaique","alarme","electricien","courant fort","courant faible"] },
  { id: "batiment",     label: "batiment",       keywords: ["maçon","maconnerie","couvreur","toiture","zingueur","carreleur","carrelage","menuisier","menuiserie","peintre","peinture","renovation","construction","batiment","travaux","artisan","charpente","isolation","plaquier","facade","enduit","ravalement","terrassier","terrassement","demolition","gros oeuvre","second oeuvre","etancheite"] },
  { id: "coiffure",     label: "coiffure",       keywords: ["coiffeur","coiffure","barbier","barber","brushing","coloration","meche","keratine","coupe","permanente","salon de coiffure"] },
  { id: "beaute",       label: "beaute",         keywords: ["esthetique","beaute","onglerie","spa","institut","massage","bien etre","soin","epilat","manucure","cils","sourcils","bronzage","hammam","nail","beauty","wellness","relaxation"] },
  { id: "fitness",      label: "fitness",        keywords: ["sport","fitness","gym","salle de sport","coach","musculation","pilates","yoga","crossfit","boxe","arts martiaux","natation","danse","tennis","foot","football","basket","musculation","cardio","aquagym"] },
  { id: "auto",         label: "auto",           keywords: ["garage","auto","automobile","mecanique","carrosserie","depannage","remorquage","pneu","pneumatique","controle technique","lavage","vitrage auto","pare brise","vehicule","voiture","moto","camion","ambulance"] },
  { id: "sante",        label: "sante",          keywords: ["medecin","docteur","dentiste","kine","kinesitherapeute","pharmacie","infirmier","osteopathe","chirurgien","opticien","gyneco","pediatre","cardio","dermato","ortho","podologue","psychologue","radiologie","clinique","cabinet medical","sage femme","audioprothesiste","orthodontiste","cabinet","centre medical","laboratoire","urgences"] },
  { id: "juridique",    label: "juridique",      keywords: ["avocat","notaire","huissier","juridique","droit","expertise comptable","comptable","expert comptable","audit","fiscal","fiduciaire","greffier"] },
  { id: "immobilier",   label: "immobilier",     keywords: ["immobilier","agence immobiliere","promotion immobiliere","agent immobilier","gestionnaire","syndic","location","transaction","estimation","patrimoine"] },
  { id: "nettoyage",    label: "nettoyage",      keywords: ["nettoyage","menage","entretien","proprete","desinfection","hygiene","laverie","blanchisserie","pressing","vitrerie"] },
  { id: "transport",    label: "transport",      keywords: ["taxi","vtc","chauffeur prive","demenagement","transport","livraison","coursier","logistique","ambulance","vsp","navette","transfer"] },
  { id: "jardinage",    label: "jardinage",      keywords: ["jardinier","jardinage","paysagiste","espaces verts","tonte","taille","elagage","arbre","debroussaillage","creation jardin"] },
  { id: "photo",        label: "photo",          keywords: ["photographe","photo","video","cameraman","studio photo","reportage","mariage","tournage","production","clip","drone"] },
  { id: "informatique", label: "informatique",   keywords: ["informatique","developpeur","web","reseau","securite informatique","tech","logiciel","cloud","maintenance informatique","depannage informatique","digital","application","site web","agence web"] },
];

// Top 200 villes françaises pour la détection dans le nom
const FR_CITIES = [
  "paris","lyon","marseille","toulouse","nice","nantes","montpellier","strasbourg","bordeaux","lille",
  "rennes","reims","le havre","saint-etienne","toulon","grenoble","dijon","angers","nimes","brest",
  "villeurbanne","le mans","clermont-ferrand","aix-en-provence","tours","amiens","limoges","metz",
  "perpignan","besancon","orleans","mulhouse","rouen","caen","nancy","avignon","poitiers","versailles",
  "pau","nanterre","creteil","vitry","colombes","argenteuil","montreuil","saint-denis","roubaix",
  "tourcoing","courbevoie","champigny","vaulx-en-velin","dunkerque","calais","colmar","chartres",
  "troyes","bourges","bayonne","biarritz","angouleme","la rochelle","niort","agen","valence","annecy",
  "chambery","saint-nazaire","lorient","quimper","boulogne","saint-maur","asnieres","rueil","cannes",
  "antibes","menton","frejus","draguignan","ajaccio","bastia","fort-de-france","pointe-a-pitre",
  "saint-brieuc","laval","albi","beziers","narbonne","carcassonne","tarbes","auch","mont-de-marsan",
  "perigueux","tulle","gueret","aurillac","privas","gap","digne","macon","chalons","epinal","verdun",
  "belfort","vesoul","lons-le-saunier","bourg-en-bresse","saint-flour","issoire","thiers","vichy",
];

function normalize(str: string): string {
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ").trim();
}

/**
 * Détecte le secteur depuis le secteur brut ET le nom de l'entreprise.
 * Retourne le label ICP ou "autre".
 */
export function normalizeSector(raw: string | null | undefined, companyName?: string | null): string {
  const sources = [raw, companyName].filter(Boolean).map(s => normalize(s!));
  for (const n of sources) {
    for (const icp of ICP_MAP) {
      for (const kw of icp.keywords) {
        const nkw = normalize(kw);
        if (n.includes(nkw)) return icp.label;
      }
    }
  }
  return "autre";
}

/**
 * Tente de détecter la ville française depuis le nom de l'entreprise.
 * Ex: "Garage Dupont Lyon" → "Lyon"
 * Ex: "remorquage auto 24h/7 Lyon" → "Lyon"
 */
export function detectCity(companyName: string | null | undefined): string | null {
  if (!companyName) return null;
  const n = normalize(companyName);
  for (const city of FR_CITIES) {
    // Cherche la ville comme mot entier
    const re = new RegExp(`\\b${city.replace(/-/g, "[\\s-]")}\\b`);
    if (re.test(n)) {
      // Capitalise la première lettre
      return city.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("-");
    }
  }
  return null;
}
