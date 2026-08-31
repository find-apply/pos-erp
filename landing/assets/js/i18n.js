/* ══════════════════════════════════════════════════════════
   DzERP landing — تعدد اللغات / Multilingue (AR ⇄ FR)
   العربية موجودة في HTML مباشرة، وهنا الترجمة الفرنسية فقط.
   Le contenu arabe vit dans le HTML ; ce fichier ne porte que le français.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FR = {
    /* ─── إمكانية الوصول / accessibilité ─── */
    'a11y.skip': "Aller au contenu",
    'a11y.home': "DzERP — page d'accueil",
    'a11y.mainNav': "Navigation principale",
    'a11y.lang': "Langue",
    'a11y.langList': "Choix de la langue",
    'a11y.theme': "Basculer le mode sombre",
    'a11y.menu': "Menu",
    'a11y.modTabs': "Catégories de modules",
    'a11y.galTabs': "Filtrer les captures",
    'a11y.productNav': "Liens produit",
    'a11y.otherNav': "Autres liens",
    'a11y.top': "Revenir en haut",
    'a11y.viewer': "Visionneuse d'image",
    'a11y.close': "Fermer",
    'a11y.prev': "Précédent",
    'a11y.next': "Suivant",

    /* ─── التنقل / navigation ─── */
    'nav.why': "Pourquoi DzERP",
    'nav.spot': "Nos atouts",
    'nav.modules': "Modules",
    'nav.shots': "Captures",
    'nav.how': "Démarrage",
    'nav.plans': "Formules",
    'nav.faq': "FAQ",
    'nav.faq2': "Questions fréquentes",
    'cta.demo': "Demander une démo",

    /* ─── الواجهة / héros ─── */
    'hero.pill': "Conçu pour le marché algérien — arabe complet et RTL",
    'hero.h1': "Un seul système pour piloter <span class='h1-line'><span class='grad'>votre entreprise</span><svg class='underline' viewBox='0 0 200 12' preserveAspectRatio='none' aria-hidden='true'><path d='M2 8c40-6 100-8 196-4'/></svg></span> de la vente au bilan",
    'hero.lead': "DzERP réunit le point de vente, le stock, les achats, la comptabilité, la distribution, le suivi de flotte, la zakat et les ressources humaines dans une seule plateforme — en dinar algérien <b>DZD</b>, sans arabisation ajoutée après coup.",
    'hero.cta2': "Voir nos atouts",
    'hero.b1': "Sans engagement",
    'hero.b2': "Paramétrage et import de vos données",
    'hero.b3': "Formation de l'équipe en arabe ou en français",
    'hero.url': "dzerp.dz / tableau de bord",
    'card.sales': "Ventes du jour",
    'card.trend': "+12 %",
    'card.dzd': "DA",
    'card.live': "En direct",
    'card.drivers': "Chauffeurs sur le terrain",
    'card.active': "actifs",

    'marquee':
      "<span>Point de vente</span><i>•</i><span>Stock</span><i>•</i><span>Dépôts et transferts</span><i>•</i>" +
      "<span>Factures</span><i>•</i><span>Achats</span><i>•</i><span>Comptabilité</span><i>•</i>" +
      "<span>Partie double</span><i>•</i><span>Distribution</span><i>•</i><span>Suivi de flotte</span><i>•</i>" +
      "<span>Zakat</span><i>•</i><span>Ressources humaines</span><i>•</i><span>Paie</span><i>•</i>" +
      "<span>CRM</span><i>•</i><span>Projets</span><i>•</i><span>Support</span><i>•</i><span>Contrats</span><i>•</i>" +
      "<span>Point de vente</span><i>•</i><span>Stock</span><i>•</i><span>Dépôts et transferts</span><i>•</i>" +
      "<span>Factures</span><i>•</i><span>Achats</span><i>•</i><span>Comptabilité</span><i>•</i>" +
      "<span>Partie double</span><i>•</i><span>Distribution</span><i>•</i><span>Suivi de flotte</span><i>•</i>" +
      "<span>Zakat</span><i>•</i><span>Ressources humaines</span><i>•</i><span>Paie</span><i>•</i>" +
      "<span>CRM</span><i>•</i><span>Projets</span><i>•</i><span>Support</span><i>•</i><span>Contrats</span><i>•</i>",

    /* ─── لماذا / pourquoi ─── */
    'why.eyebrow': "Pourquoi DzERP",
    'why.h2': "Beaucoup de systèmes internationaux… mais aucun ne connaît le fonctionnement réel d'une entreprise algérienne",
    'why.p': "Nous avons construit les modules dont vous avez réellement besoin sur le terrain, pas ceux qu'il faut traduire et rafistoler après l'achat.",
    'why.c1.t': "Local dès la conception",
    'why.c1.d': "L'arabe et le RTL ne sont pas un ajout tardif : factures, rapports et impressions sont pensés en arabe et en dinar algérien dès la première ligne.",
    'why.c2.t': "Module Zakat",
    'why.c2.d': "Calcul de l'assiette zakat à partir de la trésorerie, du stock commercial et des créances clients, avec nisab, haul et un calcul archivé et vérifiable.",
    'why.c3.t': "Distribution et chauffeurs",
    'why.c3.d': "Tournées quotidiennes, caisse par chauffeur, vente au comptant ou à crédit, et une clôture de fin de journée avec des chiffres nets.",
    'why.c4.t': "Un suivi respectueux de la vie privée",
    'why.c4.d': "Carte en direct basée sur le GPS du téléphone du chauffeur, uniquement pendant une session de travail explicite — rien en dehors des heures de service.",

    'stat.1': "modules prêts à l'emploi",
    'stat.2': "interface arabe RTL",
    'stat.3': "devise et comptabilité locales",
    'stat.4': "suivi terrain en direct",

    /* ─── ما يميّزنا / atouts ─── */
    'spot.eyebrow': "Nos atouts",
    'spot.h2': "Trois modules que vous ne trouverez pas prêts dans un système étranger",

    'spot.1.tag': "Zakat",
    'spot.1.t': "Calculez la zakat de votre entreprise depuis vos données, pas sur une feuille à part",
    'spot.1.d': "Le système lit votre trésorerie et vos soldes bancaires, votre stock commercial et vos créances clients, puis déduit le crédit déductible pour vous donner l'assiette zakat directement.",
    'spot.1.l1': "Aperçu instantané à la date du jour avant tout enregistrement",
    'spot.1.l2': "Vérification du nisab et du haul",
    'spot.1.l3': "Calcul archivé, vérifiable et auditable",
    'spot.1.l4': "Rapport détaillé prêt à imprimer",
    'spot.1.url': "Tableau de bord Zakat",

    'spot.2.tag': "Suivi de flotte",
    'spot.2.t': "Sachez où sont vos véhicules — uniquement pendant le travail",
    'spot.2.d': "Carte en direct des véhicules basée sur le GPS du téléphone du chauffeur pendant une session de suivi explicite, avec un espace de connexion dédié aux chauffeurs et un code de flotte pour une adhésion sécurisée.",
    'spot.2.l1': "Écran chauffeur pensé pour le mobile",
    'spot.2.l2': "Session de suivi démarrée et arrêtée explicitement",
    'spot.2.l3': "Code de flotte empêchant l'adhésion d'un chauffeur d'une autre société",
    'spot.2.l4': "Point d'entrée prêt pour des boîtiers GPS SIM ou OBD",
    'spot.2.url': "Carte de la flotte",

    'spot.3.tag': "Distribution et point de vente",
    'spot.3.t': "Du rayon au camion jusqu'à la caisse, avec un seul chiffre juste",
    'spot.3.d': "Vente rapide en caisse et tournées de distribution assignées aux chauffeurs avec une caisse par chauffeur — chaque opération se répercute directement sur le stock et la comptabilité, sans double saisie.",
    'spot.3.l1': "Plusieurs points de vente et plusieurs dépôts",
    'spot.3.l2': "Vente au comptant ou à crédit avec suivi du recouvrement",
    'spot.3.l3': "Analyse des performances des chauffeurs et des tournées",
    'spot.3.l4': "Transferts entre dépôts avec suivi des soldes",
    'spot.3.url': "Tableau de bord caisse",

    /* ─── الوحدات / modules ─── */
    'mod.eyebrow': "Modules",
    'mod.h2': "Tout ce dont l'entreprise a besoin, au même endroit",
    'mod.p': "Activez ce dont vous avez besoin aujourd'hui et ajoutez le reste plus tard — les données restent unifiées entre tous les modules.",

    'tab.all': "Tout",
    'tab.sales': "Vente et stock",
    'tab.finance': "Finance",
    'tab.finance2': "Finance et zakat",
    'tab.field': "Terrain",
    'tab.team': "Équipe et clients",
    'tab.tools': "Outils",

    'm1.t': "Point de vente (POS)",
    'm1.d': "Vente rapide, plusieurs caisses et dépôts, recettes du jour et panier moyen sur un seul tableau.",
    'm2.t': "Produits et stock",
    'm2.d': "SKU, prix de vente et d'achat, catégories et unités, et suivi immédiat des quantités sensibles.",
    'm3.t': "Dépôts et transferts",
    'm3.d': "Plusieurs points de stockage, transferts de produits et suivi du solde de chaque dépôt.",
    'm4.t': "Ventes et factures",
    'm4.d': "Devis, factures de vente, avoirs et suivi du règlement jusqu'à l'encaissement complet.",
    'm5.t': "Achats et fournisseurs",
    'm5.d': "Factures d'achat, retours fournisseurs et lien direct avec le stock et la comptabilité, sans double saisie.",
    'm6.t': "Comptabilité et rapports",
    'm6.d': "Plan comptable, recettes et dépenses, comptes bancaires et rapports financiers prêts pour la direction.",
    'm7.t': "Partie double",
    'm7.d': "Comptabilité avancée qui enregistre chaque opération sur deux comptes ou plus pour garder les livres équilibrés.",
    'm8.t': "Zakat",
    'm8.d': "Assiette zakat, nisab et haul, aperçu instantané et calculs archivés avec rapport détaillé.",
    'm9.t': "Budgets et objectifs",
    'm9.d': "Plan budgétaire par service ou projet, et objectifs mesurables comparés au réalisé.",
    'm10.t': "Distribution",
    'm10.d': "Tournées assignées aux chauffeurs, caisse par chauffeur, vente au comptant ou à crédit, et analyse des performances.",
    'm11.t': "Suivi de flotte",
    'm11.d': "Carte en direct des véhicules pendant les sessions de travail, avec un espace dédié aux chauffeurs.",
    'm12.t': "Ressources humaines",
    'm12.d': "Employés, présence et absences, bulletins de paie, services et postes organisés.",
    'm13.t': "CRM et projets",
    'm13.d': "Prospects, affaires par étape, projets, tâches et équipes avec des échéances claires.",
    'm14.t': "Support et contrats",
    'm14.d': "Tickets clients, base de connaissances, contrats avec montants, dates et pièces jointes.",
    'm15.t': "Formulaires et médias",
    'm15.d': "Création de formulaires sur mesure sans code, et médiathèque pour tous les fichiers et documents.",
    'm16.t': "Agenda et planning",
    'm16.d': "Vue chronologique des rendez-vous, tâches et événements, et organisation du travail quotidien.",
    'm17.t': "Paramètres et droits",
    'm17.d': "Utilisateurs et rôles, informations société, langue, devise et modèles — tout sous le contrôle du gérant.",

    /* ─── اللقطات / captures ─── */
    'gal.eyebrow': "Captures du système",
    'gal.h2': "De vrais écrans, pas des illustrations marketing",
    'gal.p': "Cliquez sur une image pour l'afficher en grand, et naviguez avec les flèches.",
    'g1': "Tableau de bord POS",
    'g2': "Créer une vente",
    'g3': "Produits et services",
    'g4': "Dépôts",
    'g5': "Factures de vente",
    'g6': "Plan comptable",
    'g7': "Rapports financiers",
    'g8': "Tableau de bord Zakat",
    'g9': "Rapport Zakat",
    'g10': "Carte de la flotte",
    'g11': "Écran chauffeur",
    'g12': "Tableau de bord CRM",
    'g13': "Ressources humaines",
    'g14': "Support et tickets",

    'alt.dashboard': "Tableau de bord DzERP",
    'alt.zakat': "Tableau de bord Zakat de DzERP",
    'alt.zakatReport': "Rapport Zakat",
    'alt.fleet': "Carte de suivi de flotte en direct",
    'alt.driver': "Écran de suivi côté chauffeur sur mobile",
    'alt.pos': "Tableau de bord du point de vente",
    'alt.posCreate': "Écran de création d'une vente",
    'alt.products': "Liste des produits et services",
    'alt.warehouses': "Gestion des dépôts",
    'alt.invoices': "Factures de vente",
    'alt.coa': "Plan comptable",
    'alt.reports': "Rapports comptables",
    'alt.crm': "Tableau de bord CRM",
    'alt.hrm': "Tableau de bord RH",
    'alt.support': "Tableau de bord du support",

    /* ─── كيف نبدأ / démarrage ─── */
    'how.eyebrow': "Comment démarrer",
    'how.h2': "Du premier contact à la mise en production",
    'how.s1.t': "Séance de cadrage",
    'how.s1.d': "Nous comprenons votre activité, votre cycle de vente et de stock, et ce qui vous fait perdre du temps aujourd'hui.",
    'how.s2.t': "Paramétrage",
    'how.s2.d': "Nous configurons la société, les dépôts, les utilisateurs et les droits, puis importons vos produits et vos clients existants.",
    'how.s3.t': "Formation de l'équipe",
    'how.s3.d': "Formation pratique par rôle : vendeur, magasinier, comptable et chauffeur — en arabe ou en français, sur vos propres données.",
    'how.s4.t': "Mise en production et suivi",
    'how.s4.d': "Nous démarrons l'exploitation réelle et restons à vos côtés pour les ajustements et l'ajout de modules.",

    /* ─── الباقات / formules ─── */
    'plan.eyebrow': "Formules",
    'plan.h2': "Commencez avec l'essentiel, et faites grandir le système avec votre entreprise",
    'plan.p': "Le prix dépend du nombre d'utilisateurs et des modules activés — demandez un devis détaillé.",
    'plan.price': "Devis <span>sur mesure</span>",
    'plan.cta': "Demander un devis",
    'plan.badge': "La plus demandée",
    'plan.1.t': "Commerce",
    'plan.1.s': "Pour les magasins et points de vente",
    'plan.1.l1': "Point de vente (POS)",
    'plan.1.l2': "Produits et stock",
    'plan.1.l3': "Clients et factures",
    'plan.1.l4': "Rapports de vente quotidiens",
    'plan.1.l5': "Utilisateurs et droits",
    'plan.2.t': "Entreprise",
    'plan.2.s': "Pour les sociétés commerciales et de distribution",
    'plan.2.l1': "Tout ce que contient la formule Commerce",
    'plan.2.l2': "Achats et fournisseurs",
    'plan.2.l3': "Plusieurs dépôts et transferts",
    'plan.2.l4': "Comptabilité et rapports financiers",
    'plan.2.l5': "Distribution et caisses chauffeurs",
    'plan.2.l6': "Zakat",
    'plan.3.t': "Avancée",
    'plan.3.s': "Pour les groupes multi-activités",
    'plan.3.l1': "Tout ce que contient la formule Entreprise",
    'plan.3.l2': "Suivi de flotte en direct",
    'plan.3.l3': "RH et paie",
    'plan.3.l4': "CRM, projets et contrats",
    'plan.3.l5': "Partie double et budgets",
    'plan.3.l6': "Accompagnement et personnalisation sur demande",

    /* ─── الأسئلة / FAQ ─── */
    'faq.eyebrow': "Questions fréquentes",
    'faq.h2': "Ce que la plupart des clients demandent avant de commencer",
    'faq.q1': "Le système fonctionne-t-il entièrement en arabe ?",
    'faq.a1': "Oui. L'interface, les menus, les factures et les rapports sont en arabe et de droite à gauche, et la devise par défaut est le dinar algérien (DA). Une interface française est également disponible.",
    'faq.q2': "Peut-on n'activer que certains modules ?",
    'faq.a2': "Oui. Le système est découpé en modules indépendants : activez ce dont vous avez besoin aujourd'hui et ajoutez le reste plus tard, sans réinstallation ni perte de données.",
    'faq.q3': "Fonctionne-t-il sur mobile ?",
    'faq.a3': "L'interface est responsive sur mobile et tablette, et les chauffeurs disposent d'un écran de suivi dédié avec leur propre espace de connexion.",
    'faq.q4': "Comment fonctionne le suivi de flotte ? Respecte-t-il la vie privée du chauffeur ?",
    'faq.a4': "La position n'est enregistrée qu'après le démarrage explicite d'une session de suivi pendant le travail, et s'arrête à sa clôture. Aucun suivi en dehors des heures de service.",
    'faq.q5': "Peut-on importer nos données actuelles ?",
    'faq.a5': "Oui, nous vous aidons à importer les produits, les clients, les fournisseurs et les soldes de stock pendant la phase de paramétrage.",
    'faq.q6': "Où sont stockées les données ?",
    'faq.a6': "DzERP peut tourner sur un serveur qui vous appartient ou sur un hébergement que nous gérons pour vous — le choix vous revient selon votre politique interne.",

    /* ─── الاتصال / contact ─── */
    'contact.eyebrow': "Commencez aujourd'hui",
    'contact.h2': "Prêt à voir DzERP sur les données de votre entreprise ?",
    'contact.p': "Laissez vos coordonnées et nous organisons une démo en direct, ou contactez-nous directement.",
    'contact.city': "Alger, Algérie",
    'form.name': "Nom complet",
    'form.namePh': "Mohamed Benahmed",
    'form.company': "Entreprise",
    'form.companyPh': "Nom de la société",
    'form.phone': "Téléphone",
    'form.need': "De quoi avez-vous le plus besoin ?",
    'form.o1': "Caisse et stock",
    'form.o2': "Comptabilité et rapports",
    'form.o3': "Distribution et chauffeurs",
    'form.o4': "Suivi de flotte",
    'form.o5': "Zakat",
    'form.o6': "Système complet",
    'form.submit': "Envoyer la demande",
    'form.err': "Merci d'indiquer votre nom et votre téléphone.",
    'form.ok': "Demande enregistrée ✓ Nous vous rappelons très vite — merci de votre confiance.",

    /* ─── التذييل / pied de page ─── */
    'footer.about': "Système de gestion intégré (ERP) et point de vente, conçu pour les entreprises algériennes — en arabe et en dinar algérien.",
    'footer.product': "Produit",
    'footer.company': "Société",
    'footer.contact': "Contact",
    'footer.rights': "© <span id='year'>2026</span> DzERP. Tous droits réservés.",
    'footer.made': "Fait en Algérie 🇩🇿",

    /* ─── وسم الصفحة / métadonnées ─── */
    'meta.title': "DzERP — l'ERP conçu pour le marché algérien",
    'meta.desc': "DzERP : ERP et point de vente complets — ventes, stock, comptabilité, distribution, suivi de flotte, zakat et RH, en dinar algérien.",
    'num.percent': "%"
  };

  /* مفاتيح لا توجد في HTML لأن الجافاسكريبت هو من يكتبها */
  var AR = {
    'form.err': "المرجو إدخال الاسم ورقم الهاتف.",
    'form.ok': "تم تسجيل طلبك ✓ سنتصل بك في أقرب وقت — شكرا لثقتك.",
    'meta.title': "DzERP — نظام إدارة الموارد المصمم للسوق الجزائري",
    'meta.desc': "DzERP نظام ERP و POS متكامل بالعربية: مبيعات، مخازن، محاسبة، توزيع، تتبع أسطول، زكاة وموارد بشرية — بالدينار الجزائري واتجاه RTL.",
    'num.percent': "٪"
  };

  var KEY = 'dzerp-lang';
  var root = document.documentElement;
  var originals = { html: {}, aria: {}, ph: {}, alt: {} };
  var current = 'ar';

  function collect() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      originals.html[el.dataset.i18n] = el.innerHTML;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-aria]'), function (el) {
      originals.aria[el.dataset.i18nAria] = el.getAttribute('aria-label');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (el) {
      originals.ph[el.dataset.i18nPh] = el.getAttribute('placeholder');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-alt]'), function (el) {
      originals.alt[el.dataset.i18nAlt] = el.getAttribute('alt');
    });
  }

  function t(key) {
    if (current === 'fr') return FR[key] != null ? FR[key] : (AR[key] || key);
    return AR[key] != null ? AR[key] : (originals.html[key] || key);
  }

  function apply(lang) {
    current = lang === 'fr' ? 'fr' : 'ar';
    var fr = current === 'fr';

    root.setAttribute('lang', fr ? 'fr' : 'ar');
    root.setAttribute('dir', fr ? 'ltr' : 'rtl');

    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      var k = el.dataset.i18n;
      var v = fr ? FR[k] : originals.html[k];
      if (v != null) el.innerHTML = v;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-aria]'), function (el) {
      var k = el.dataset.i18nAria;
      var v = fr ? FR[k] : originals.aria[k];
      if (v != null) el.setAttribute('aria-label', v);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-ph]'), function (el) {
      var k = el.dataset.i18nPh;
      var v = fr ? FR[k] : originals.ph[k];
      if (v != null) el.setAttribute('placeholder', v);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-alt]'), function (el) {
      var k = el.dataset.i18nAlt;
      var v = fr ? FR[k] : originals.alt[k];
      if (v != null) el.setAttribute('alt', v);
    });

    /* رمز النسبة في العدّاد */
    var pct = document.querySelector('[data-count][data-suffix]');
    if (pct) {
      pct.dataset.suffix = t('num.percent');
      pct.textContent = (pct.dataset.prefix || '') + pct.dataset.count + pct.dataset.suffix;
      delete pct.dataset.done;
    }

    document.title = t('meta.title');
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.desc'));

    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    var code = document.getElementById('langCode');
    if (code) code.textContent = fr ? 'FR' : 'AR';

    Array.prototype.forEach.call(document.querySelectorAll('.lang-opt'), function (b) {
      var on = b.dataset.lang === current;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });

    try { localStorage.setItem(KEY, current); } catch (e) {}
    document.dispatchEvent(new CustomEvent('dz:lang', { detail: { lang: current } }));
  }

  collect();

  /* الأولوية: ?lang=fr في الرابط، ثم الاختيار المحفوظ، ثم لغة المتصفح */
  var saved = (location.search.match(/[?&]lang=(ar|fr)/) || [])[1];
  if (!saved) { try { saved = localStorage.getItem(KEY); } catch (e) {} }
  if (!saved) saved = (navigator.language || '').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'ar';
  if (saved === 'fr') apply('fr'); else apply('ar');

  /* ─── القائمة المنسدلة / menu déroulant ─── */
  var wrap = document.getElementById('langMenu');
  var trigger = document.getElementById('langBtn');
  var pop = document.getElementById('langPop');

  function openMenu(open) {
    if (!pop || !trigger) return;
    pop.hidden = !open;
    wrap.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      var active = pop.querySelector('.lang-opt.is-active') || pop.firstElementChild;
      if (active) active.focus();
    }
  }

  if (trigger && pop) {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      openMenu(pop.hidden);
    });

    Array.prototype.forEach.call(pop.querySelectorAll('.lang-opt'), function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.dataset.lang);
        openMenu(false);
        trigger.focus();
      });
    });

    pop.addEventListener('keydown', function (e) {
      var opts = Array.prototype.slice.call(pop.querySelectorAll('.lang-opt'));
      var i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var next = (i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
        opts[next].focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!pop.hidden && !wrap.contains(e.target)) openMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pop.hidden) { openMenu(false); trigger.focus(); }
    });
  }

  window.DzI18n = { t: t, apply: apply, get lang() { return current; } };
})();
