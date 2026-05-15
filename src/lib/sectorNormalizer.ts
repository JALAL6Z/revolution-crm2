// Normalise n'importe quelle valeur de secteur vers un ICP standardisé
// Utilisé à l'import (Google Sheets, CSV, Google Maps) pour lier automatiquement l'activité

const ICP_MAP: { id: string; label: string; keywords: string[] }[] = [
  { id: "restaurant",   label: "Restaurant",     keywords: ["restaurant","brasserie","pizzeria","traiteur","cafe","bar","bistrot","creperie","sushi","kebab","burger","snack","fast food","bouche","boulan","patisserie","boucher","boulanger"] },
  { id: "plomberie",    label: "Plomberie",      keywords: ["plombier","plomberie","chauffagiste","chauffage","sanitaire","chaudiere","climatisation","pompe a chaleur","pac","radia","debouchage","canalisation"] },
  { id: "electricite",  label: "Électricité",    keywords: ["electricien","electricite","electrique","domotique","tableau","panneau solaire","photovoltaique","alarme"] },
  { id: "batiment",     label: "Bâtiment",       keywords: ["mason","maçon","maconnerie","couvreur","toiture","zingueur","carreleur","carrelage","menuisier","menuiserie","peintre","peinture","renovation","construction","batiment","travaux","artisan","charpente","isolation","placo","plaquier","facade","enduit","ravalement"] },
  { id: "coiffure",     label: "Coiffure",       keywords: ["coiffeur","coiffure","salon","barbier","barber","coupe","brushing","coloration","mèches","keratine"] },
  { id: "beaute",       label: "Beauté",         keywords: ["esthetique","beaute","onglerie","spa","institut","massage","bien etre","soin","epilat","manucure","cils","sourcils","bronzage","hammam"] },
  { id: "fitness",      label: "Fitness",        keywords: ["sport","fitness","gym","salle de sport","coach","musculation","pilates","yoga","crossfit","boxe","arts martiaux","natation","danse"] },
  { id: "auto",         label: "Auto / Garage",  keywords: ["garage","auto","automobile","mecanique","carrosserie","reparation vehicule","pneumatique","pneu","controle technique","depannage auto","lavage auto","vitrage auto"] },
  { id: "sante",        label: "Santé",          keywords: ["medecin","docteur","dentiste","kine","kinesitherapeute","pharmacie","infirmier","osteopathe","chirurgien","opticien","gyneco","pedia","cardio","dermato","ortho","podologue","psychologue","radiologie","clinique","cabinet medical","sage femme","audioprothesiste"] },
  { id: "juridique",    label: "Juridique",      keywords: ["avocat","notaire","huissier","juridique","droit","cabinet","conseil","expertise comptable","comptable","expert comptable","fisc","audit"] },
  { id: "immobilier",   label: "Immobilier",     keywords: ["immobilier","agence immobiliere","promotion","agent immobilier","gestionnaire","syndic","location","vente","achat maison","appartement"] },
  { id: "nettoyage",    label: "Nettoyage",      keywords: ["nettoyage","menage","entretien","proprete","desinfection","hygiene","produit nettoyage","laverie","blanchisserie"] },
  { id: "transport",    label: "Transport",      keywords: ["taxi","vtc","chauffeur","demenagement","transport","livraison","coursier","logistique","ambulance","vsp"] },
  { id: "jardinage",    label: "Jardinage",      keywords: ["jardinier","jardinage","paysagiste","paysage","espaces verts","tonte","taille","elagage","arbre","debroussaillage"] },
  { id: "photo",        label: "Photo / Vidéo",  keywords: ["photographe","photo","video","cameraman","studio","reportage","mariage","tournage","production","clip"] },
  { id: "informatique", label: "Informatique",   keywords: ["informatique","it","developpeur","web","reseau","securite","tech","digital","logiciel","erp","crm","cloud","maintenance informatique","depannage informatique"] },
];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prend une valeur brute de secteur/catégorie et retourne
 * le label ICP standardisé (ex: "Plomberie", "Restaurant"...)
 * ou la valeur originale nettoyée si aucun match.
 */
export function normalizeSector(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "autre";
  const n = normalize(raw);
  for (const icp of ICP_MAP) {
    for (const kw of icp.keywords) {
      if (n.includes(normalize(kw))) return icp.label.toLowerCase();
    }
  }
  // Pas de match → on retourne la valeur nettoyée en minuscules
  return n.slice(0, 50);
}
