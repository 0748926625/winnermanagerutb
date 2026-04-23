// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAwQhUFlZWTGebL2c5RB6OF9m95Wwut4Ck",
    authDomain: "winner-express.firebaseapp.com",
    projectId: "winner-express",
    storageBucket: "winner-express.firebasestorage.app",
    messagingSenderId: "619154248559",
    appId: "1:619154248559:web:14f85763a9c4d55cdece9a",
    measurementId: "G-D3HTJYJESF"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

class DeliveryDashboard {
    constructor() {
        this.currentMode = 'general'; // 'general' ou 'utb'
        this.data = JSON.parse(localStorage.getItem('deliveryHistoricalData')) || {};
        this.currentDate = new Date().toISOString().split('T')[0];

        this.initSelectors();
        this.initEventListeners();

        // Initialiser Firebase et se connecter automatiquement
        this.initFirebase();

        // Ne charger les données du formulaire que si on est sur la page principale
        if (document.getElementById('liv-1000')) {
            this.applyDefaultMargins();
            this.loadDateData(this.currentDate);
        }

        // Charger les données pour les graphiques après un court délai
        setTimeout(() => {
            this.loadChartData();
            this.updateChartPeriod('month'); // Par défaut : mois en cours
        }, 500);
    }

    // Clé localStorage selon le mode actif
    getStorageKey() {
        return this.currentMode === 'utb' ? 'utbHistoricalData' : 'deliveryHistoricalData';
    }

    // Champ Firebase selon le mode actif
    getFirebaseField() {
        return this.currentMode === 'utb' ? 'utbDeliveryData' : 'deliveryData';
    }

    switchMode(mode) {
        if (this.currentMode === mode) return;

        const tabGeneral  = document.getElementById('tab-general');
        const tabUtb      = document.getElementById('tab-utb');
        const tabLivreurs = document.getElementById('tab-livreurs');
        const contentDel  = document.getElementById('content-deliveries');
        const contentLiv  = document.getElementById('content-livreurs');

        // Réinitialiser tous les onglets
        const inactiveClass = 'tab-btn px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 text-gray-500 hover:bg-gray-100';
        tabGeneral.className  = inactiveClass;
        tabUtb.className      = inactiveClass;
        tabLivreurs.className = inactiveClass;

        if (mode === 'livreurs') {
            // Sauvegarder avant de quitter le mode livraisons
            if (this.currentMode !== 'livreurs') this.save();
            this.currentMode = mode;

            tabLivreurs.className = 'tab-btn px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 text-white shadow-md';
            tabLivreurs.style.background = '#6d28d9';
            tabGeneral.style.background  = '';
            tabUtb.style.background      = '';

            contentDel.classList.add('hidden');
            contentLiv.classList.remove('hidden');
            document.body.style.backgroundColor = '#f5f3ff';

            // Initialiser la date et rendre le tableau
            const dateInput = document.getElementById('livreur-date');
            if (dateInput && !dateInput.value) {
                dateInput.value = this.currentDate;
                dateInput.addEventListener('change', () => this.renderLivreursDailyTable());
            }
            // Afficher ce qu'on a en local immédiatement
            this.renderLivreursList();
            this.renderLivreursDailyTable();
            // Puis récupérer Firebase et rafraîchir
            this.loadLivreursFromFirebase();

        } else {
            // Sauvegarder avant de quitter livreurs
            if (this.currentMode === 'livreurs') this.saveLivreurDay();
            this.currentMode = mode;
            this.data = JSON.parse(localStorage.getItem(this.getStorageKey())) || {};

            contentLiv.classList.add('hidden');
            contentDel.classList.remove('hidden');

            tabLivreurs.style.background = '';

            const formTitle = document.getElementById('form-title');
            const formIcon  = document.getElementById('form-icon');

            if (mode === 'utb') {
                tabUtb.className  = 'tab-btn px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 text-white shadow-md';
                tabUtb.style.background = '#ea580c';
                if (formTitle) formTitle.textContent = 'Saisie Journalière — UTB';
                if (formIcon)  formIcon.className = 'w-8 h-8 rounded-lg flex items-center justify-center mr-3';
                if (formIcon)  formIcon.style.background = '#ea580c';
                document.body.style.backgroundColor = '#4c1d95';
            } else {
                tabGeneral.className  = 'tab-btn px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 text-white shadow-md';
                tabGeneral.style.background = '#059669';
                if (formTitle) formTitle.textContent = 'Saisie Journalière';
                if (formIcon)  formIcon.className = 'w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center mr-3';
                if (formIcon)  formIcon.style.background = '';
                document.body.style.backgroundColor = '#f3f4f6';
            }

            if (document.getElementById('liv-1000')) {
                this.applyDefaultMargins();
                this.loadDateData(this.currentDate);
            }
            this.updateChartPeriod('month');
        }
    }

    initSelectors() {
        this.dateInput = document.getElementById('workingDateSelector');
        if (this.dateInput) {
            this.dateInput.value = this.currentDate;
        }
        this.diversContainer = document.getElementById('divers-container');
    }

    initEventListeners() {
        document.addEventListener('input', (e) => {
            if (e.target.type === 'number' || e.target.tagName === 'TEXTAREA') {
                this.calculate();
            }
        });

        // Écouter les changements sur le sélecteur de date
        if (this.dateInput) {
            this.dateInput.addEventListener('change', () => this.changeDate());
        }
    }

    changeDate() {
        if (!this.dateInput) return; // Ne pas exécuter si l'élément n'existe pas
        
        this.save(); 
        this.currentDate = this.dateInput.value;
        this.loadDateData(this.currentDate);
    }

    calculate() {
        // Vérifier si nous sommes sur la page principale (index.html)
        if (!document.getElementById('liv-1000')) {
            return; // Ne pas calculer si les éléments n'existent pas
        }
        
        let totalLiv = 0, totalEch = 0, brut = 0, net = 0;

        // Calcul des livraisons et marges
        [1000, 1500, 2000, 2500].forEach(val => {
            const qty = Math.max(0, parseInt(document.getElementById(`liv-${val}`).value) || 0);
            const echInput = Math.max(0, parseInt(document.getElementById(`ech-${val}`).value) || 0);
            const margPct = (parseFloat(document.getElementById(`mar-${val}`).value) || 0) / 100;
            
            // On ne peut pas avoir plus d'échecs que de livraisons
            const ech = Math.min(qty, echInput);
            const reussies = qty - ech;
            
            totalLiv += qty;
            totalEch += ech;
            brut += reussies * val;
            net += (reussies * val) * margPct;
        });

        // Calcul des dépenses
        let totalDep = 0;
        totalDep += parseFloat(document.getElementById('dep-car-f').value) || 0;
        totalDep += parseFloat(document.getElementById('dep-maint').value) || 0;
        totalDep += parseFloat(document.getElementById('dep-fixes').value) || 0;

        // Dépenses diverses dynamiques
        document.querySelectorAll('.divers-row').forEach(row => {
            totalDep += parseFloat(row.querySelector('.div-amt').value) || 0;
        });

        this.updateUI({
            totalLiv, 
            totalEch, 
            reussies: totalLiv - totalEch, 
            brut, 
            net, 
            totalDep, 
            balance: net - totalDep
        });
    }

    updateUI(s) {
        // Vérifier si les éléments existent avant de les mettre à jour
        const statTotalLiv = document.getElementById('stat-total-liv');
        const statEchouees = document.getElementById('stat-echouees');
        const statReussies = document.getElementById('stat-reussies');
        const statBrut = document.getElementById('stat-brut');
        const statNet = document.getElementById('stat-net');
        const statBenefice = document.getElementById('stat-benefice');
        const bilanRecettes = document.getElementById('bilan-recettes');
        const bilanDepenses = document.getElementById('bilan-depenses');
        const bilanBalance = document.getElementById('bilan-balance');
        
        if (statTotalLiv) statTotalLiv.textContent = s.totalLiv;
        if (statEchouees) statEchouees.textContent = s.totalEch;
        if (statReussies) statReussies.textContent = s.reussies;
        if (statBrut) statBrut.textContent = this.formatFCFA(s.brut);
        if (statNet) statNet.textContent = this.formatFCFA(s.net);
        
        if (statBenefice) {
            statBenefice.textContent = this.formatFCFA(s.balance);
            statBenefice.className = `font-bold text-xl ${s.balance >= 0 ? 'text-green-600' : 'text-red-600'}`;
        }
        
        if (bilanRecettes) bilanRecettes.textContent = this.formatFCFA(s.net);
        if (bilanDepenses) bilanDepenses.textContent = this.formatFCFA(s.totalDep);
        
        if (bilanBalance) {
            bilanBalance.textContent = this.formatFCFA(s.balance);
            bilanBalance.className = `text-3xl font-black rounded-lg py-2 mt-1 ${s.balance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
        }
    }

    formatFCFA(v) {
        return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + " FCFA";
    }

    defaultMargin() {
        return this.currentMode === 'utb' ? 60 : 75;
    }

    applyDefaultMargins() {
        const m = this.defaultMargin();
        ['mar-1000','mar-1500','mar-2000','mar-2500'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = m;
        });
    }

    // Gestion des dépenses personnalisées
    addDiversRow(nom = "", mt = "") {
        if (!this.diversContainer) {
            return; // Ne pas ajouter de ligne si le container n'existe pas
        }
        
        const div = document.createElement('div');
        div.className = "divers-row flex gap-2 items-center animate-in";
        div.innerHTML = `
            <input type="text" class="div-nom input-modern flex-1 p-2 rounded text-xs" placeholder="Ex: Achat sacs" value="${nom}">
            <input type="number" class="div-amt input-modern w-24 p-2 rounded text-xs" placeholder="Montant" value="${mt}">
            <button onclick="this.parentElement.remove(); dashboard.calculate();" class="text-red-400 hover:text-red-600 transition p-2"><i class="fas fa-trash-alt"></i></button>
        `;
        this.diversContainer.appendChild(div);
    }

    save() {
        // Vérifier si les éléments du formulaire existent avant de sauvegarder
        if (!document.getElementById('liv-1000')) {
            return; // Ne pas sauvegarder si on n'est pas sur la page principale
        }
        
        const divers = [];
        document.querySelectorAll('.divers-row').forEach(row => {
            const n = row.querySelector('.div-nom').value;
            const m = row.querySelector('.div-amt').value;
            if(n || m) divers.push({ nom: n, mt: m });
        });

        const liv1000 = document.getElementById('liv-1000');
        const liv1500 = document.getElementById('liv-1500');
        const liv2000 = document.getElementById('liv-2000');
        const liv2500 = document.getElementById('liv-2500');
        const ech1000 = document.getElementById('ech-1000');
        const ech1500 = document.getElementById('ech-1500');
        const ech2000 = document.getElementById('ech-2000');
        const ech2500 = document.getElementById('ech-2500');
        const mar1000 = document.getElementById('mar-1000');
        const mar1500 = document.getElementById('mar-1500');
        const mar2000 = document.getElementById('mar-2000');
        const mar2500 = document.getElementById('mar-2500');
        
        const depCarL = document.getElementById('dep-car-l');
        const depCarF = document.getElementById('dep-car-f');
        const depMaint = document.getElementById('dep-maint');
        const depFixes = document.getElementById('dep-fixes');
        const obsText = document.getElementById('obs-text');

        const dayData = {
            liv: {
                l1000: liv1000 ? liv1000.value : 0,
                l1500: liv1500 ? liv1500.value : 0,
                l2000: liv2000 ? liv2000.value : 0,
                l2500: liv2500 ? liv2500.value : 0,
                e1000: ech1000 ? ech1000.value : 0,
                e1500: ech1500 ? ech1500.value : 0,
                e2000: ech2000 ? ech2000.value : 0,
                e2500: ech2500 ? ech2500.value : 0,
                m1000: mar1000 ? mar1000.value : this.defaultMargin(),
                m1500: mar1500 ? mar1500.value : this.defaultMargin(),
                m2000: mar2000 ? mar2000.value : this.defaultMargin(),
                m2500: mar2500 ? mar2500.value : this.defaultMargin()
            },
            dep: {
                carL: depCarL ? depCarL.value : 0,
                carF: depCarF ? depCarF.value : 0,
                maint: depMaint ? depMaint.value : 0,
                fixes: depFixes ? depFixes.value : 0,
                divers: divers
            },
            obs: obsText ? obsText.value : ""
        };

        this.data[this.currentDate] = dayData;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.data));
        this.showStatus();
    }

    loadDateData(date) {
        // Vérifier si les éléments du formulaire existent avant de charger les données
        if (!document.getElementById('liv-1000')) {
            return; // Ne pas charger les données si on n'est pas sur la page principale
        }
        
        const d = this.data[date];
        this.clearFields();
        if (d) {
            const liv1000 = document.getElementById('liv-1000');
            const liv1500 = document.getElementById('liv-1500');
            const liv2000 = document.getElementById('liv-2000');
            const liv2500 = document.getElementById('liv-2500');
            const ech1000 = document.getElementById('ech-1000');
            const ech1500 = document.getElementById('ech-1500');
            const ech2000 = document.getElementById('ech-2000');
            const ech2500 = document.getElementById('ech-2500');
            const mar1000 = document.getElementById('mar-1000');
            const mar1500 = document.getElementById('mar-1500');
            const mar2000 = document.getElementById('mar-2000');
            const mar2500 = document.getElementById('mar-2500');
            
            if (liv1000) liv1000.value = d.liv.l1000;
            if (liv1500) liv1500.value = d.liv.l1500;
            if (liv2000) liv2000.value = d.liv.l2000;
            if (liv2500) liv2500.value = d.liv.l2500;
            if (ech1000) ech1000.value = d.liv.e1000;
            if (ech1500) ech1500.value = d.liv.e1500;
            if (ech2000) ech2000.value = d.liv.e2000;
            if (ech2500) ech2500.value = d.liv.e2500;
            const defMarg = this.defaultMargin();
            if (mar1000) mar1000.value = this.currentMode === 'utb' ? defMarg : (d.liv.m1000 || defMarg);
            if (mar1500) mar1500.value = this.currentMode === 'utb' ? defMarg : (d.liv.m1500 || defMarg);
            if (mar2000) mar2000.value = this.currentMode === 'utb' ? defMarg : (d.liv.m2000 || defMarg);
            if (mar2500) mar2500.value = this.currentMode === 'utb' ? defMarg : (d.liv.m2500 || defMarg);
            
            const depCarL = document.getElementById('dep-car-l');
            const depCarF = document.getElementById('dep-car-f');
            const depMaint = document.getElementById('dep-maint');
            const depFixes = document.getElementById('dep-fixes');
            
            if (depCarL) depCarL.value = d.dep.carL;
            if (depCarF) depCarF.value = d.dep.carF;
            if (depMaint) depMaint.value = d.dep.maint;
            if (depFixes) depFixes.value = d.dep.fixes;
            
            if(d.dep.divers) d.dep.divers.forEach(div => this.addDiversRow(div.nom, div.mt));
            
            const obsText = document.getElementById('obs-text');
            if (obsText) obsText.value = d.obs || "";
        }
        this.calculate();
    }

    clearFields() {
        // Vérifier si les éléments existent avant de les modifier
        const inputs = document.querySelectorAll('input[type="number"]');
        inputs.forEach(i => {
            if (i.id && i.id.includes('mar-')) {
                i.value = this.defaultMargin();
            } else if (i.id) {
                i.value = 0;
            }
        });
        
        const obsText = document.getElementById('obs-text');
        if (obsText) {
            obsText.value = "";
        }
        
        if (this.diversContainer) {
            this.diversContainer.innerHTML = "";
        }
    }

    showStatus() {
        // Créer une notification moderne et visible
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center space-x-3 notification-enter';
        const modeLabel = this.currentMode === 'utb' ? 'UTB' : 'Clients Généraux';
        notification.innerHTML = `
            <div class="flex-shrink-0">
                <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center animate-pulse">
                    <i class="fas fa-check text-green-500 text-sm"></i>
                </div>
            </div>
            <div>
                <p class="font-semibold">Données enregistrées — ${modeLabel}</p>
                <p class="text-sm opacity-90">Vos informations ont été sauvegardées avec succès</p>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.classList.remove('notification-enter');
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 50);
        
        // Disparition après 3 secondes
        setTimeout(() => {
            notification.classList.add('notification-exit');
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    exportReport() {
        const d = this.currentDate;
        const res = this.data[d];
        if(!res) return alert("Pas de données.");
        
        // Calculer toutes les statistiques
        let totalLiv = 0, totalEch = 0, brut = 0, net = 0;
        let totalReussies = 0;
        let details = [];
        
        [1000, 1500, 2000, 2500].forEach(val => {
            const qty = Math.max(0, parseInt(res.liv[`l${val}`]) || 0);
            const ech = Math.min(qty, Math.max(0, parseInt(res.liv[`e${val}`]) || 0));
            const reussies = qty - ech;
            const margPct = (parseFloat(res.liv[`m${val}`]) || this.defaultMargin()) / 100;
            const recette = reussies * val;
            const recetteNet = recette * margPct;
            
            totalLiv += qty;
            totalEch += ech;
            totalReussies += reussies;
            brut += recette;
            net += recetteNet;
            
            details.push({
                val,
                qty,
                ech,
                reussies,
                margPct: (margPct * 100).toFixed(0),
                recette,
                recetteNet
            });
        });
        
        // Calculer les dépenses
        let totalDep = parseFloat(res.dep.carF) || 0;
        const carL = parseFloat(res.dep.carL) || 0;
        const maint = parseFloat(res.dep.maint) || 0;
        const fixes = parseFloat(res.dep.fixes) || 0;
        
        totalDep += maint + fixes;
        
        // Calculer la répartition
        const partPartenaires = Math.round(net * 0.25);
        const balance = net - totalDep;
        const rentabilite = totalDep > 0 ? ((net / totalDep) * 100).toFixed(1) : '0.0';
        
        // Formater la date
        const dateObj = new Date(d);
        const dateFr = dateObj.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const heure = new Date().toLocaleTimeString('fr-FR');
        
        // Générer le rapport complet
        let rapport = `RAPPORT JOURNALIER - WINNER EXPRESS
Date: ${dateFr}
Heure: ${heure}
=====================================

            LIVRAISONS DU JOUR
=====================================`;
        
        details.forEach(detail => {
            rapport += `\nLivraisons ${detail.val} FCFA: ${detail.qty}
Échecs ${detail.val} FCFA: ${detail.ech}`;
        });
        
        rapport += `\n-------------------------------------
Total livraisons: ${totalLiv}
Total échecs: ${totalEch}
Livraisons réussies: ${totalReussies}

=====================================
            MARGES ET RECETTES
=====================================
Recettes brutes: ${this.formatFCFA(brut)}`;
        
        if (totalReussies > 0) {
            const moyenne = Math.round(brut / totalReussies);
            rapport += `\nMoyenne par livraison: ${this.formatFCFA(moyenne)}`;
        }
        
        rapport += `\nMarge 1000 FCFA: ${details.find(d => d.val === 1000)?.margPct || this.defaultMargin()}%
Marge 1500 FCFA: ${details.find(d => d.val === 1500)?.margPct || this.defaultMargin()}%
Marge 2000 FCFA: ${details.find(d => d.val === 2000)?.margPct || this.defaultMargin()}%
Marge 2500 FCFA: ${details.find(d => d.val === 2500)?.margPct || this.defaultMargin()}%
-------------------------------------
Part partenaires: ${this.formatFCFA(partPartenaires)}
RECETTES NETTES: ${this.formatFCFA(net)}

=====================================
            DÉPENSES DU JOUR
=====================================
Carburant: ${carL}L
Coût carburant: ${this.formatFCFA(parseFloat(res.dep.carF) || 0)}
Maintenance: ${this.formatFCFA(maint)}
Autres dépenses fixes: ${this.formatFCFA(fixes)}
-------------------------------------
DÉPENSES TOTALES: ${this.formatFCFA(totalDep)}

=====================================
            BALANCE DU JOUR
=====================================
RECETTES NETTES: ${this.formatFCFA(net)}
DÉPENSES TOTALES: ${this.formatFCFA(totalDep)}
-------------------------------------
BÉNÉFICE NET: ${this.formatFCFA(balance)}

=====================================
            OBSERVATIONS
=====================================
${res.obs || "Aucune observation pour cette journée."}

=====================================
            RÉSUMÉ
=====================================
Rentabilité: ${rentabilite}%
${balance >= 0 ? '✅ JOURNÉE RENTABLE' : '❌ JOURNÉE DÉFICITAIRE'}

=====================================
Généré par Winner Express - ${dateObj.toLocaleDateString('fr-FR')} ${heure}`;
        
        // Ajout du BOM (\uFEFF) pour forcer l'encodage UTF-8 correct sur mobile et Excel
        const blob = new Blob(['\uFEFF' + rapport], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Winner_Express_Rapport_${d}.txt`;
        link.click();
    }

    // Méthodes pour le graphique principal (page d'accueil)
    updateChartPeriod(periodType) {
        const today = new Date();
        // Normaliser à midi pour éviter les décalages de fuseau horaire
        today.setHours(12, 0, 0, 0);
        
        let startDate, endDate;

        if (periodType === 'week') {
            // Semaine en cours (Lundi au Dimanche)
            const day = today.getDay(); // 0 (Dim) à 6 (Sam)
            const diff = today.getDate() - day + (day === 0 ? -6 : 1); // ajuster pour que lundi soit le premier jour
            startDate = new Date(today);
            startDate.setDate(diff);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
        } else if (periodType === 'month') {
            // Mois en cours (1er au dernier jour)
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (periodType === 'custom') {
            // Période personnalisée
            const startInput = document.getElementById('chart-start').value;
            const endInput = document.getElementById('chart-end').value;
            if (!startInput || !endInput) return alert("Veuillez sélectionner les deux dates.");
            startDate = new Date(startInput);
            startDate.setHours(12, 0, 0, 0);
            endDate = new Date(endInput);
            endDate.setHours(12, 0, 0, 0);
        }

        // Gérer l'état visuel des boutons
        const buttons = {
            week: document.getElementById('btn-chart-week'),
            month: document.getElementById('btn-chart-month'),
            custom: document.getElementById('btn-chart-custom')
        };

        // Réinitialiser tous les boutons
        Object.values(buttons).forEach(btn => {
            if (btn) btn.classList.remove('bg-blue-500');
        });

        // Activer le bon bouton
        if (buttons[periodType]) {
            buttons[periodType].classList.add('bg-white', 'text-blue-600');
        }

        // Cacher la sélection de date personnalisée si une autre option est choisie
        if (periodType !== 'custom' && document.getElementById('custom-date-range')) {
            document.getElementById('custom-date-range').classList.add('hidden');
        }

        this.initMainChart(startDate, endDate);
    }

    initMainChart(startDate, endDate) {
        // Vérifier si Chart.js est chargé
        if (typeof Chart === 'undefined') {
            console.error('Chart.js non chargé, nouvelle tentative dans 500ms...');
            setTimeout(() => this.initMainChart(startDate, endDate), 500);
            return;
        }

        const canvas = document.getElementById('mainEvolutionChart');
        if (!canvas) return;
        
        // Nettoyer proprement l'ancien graphique s'il existe
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        // Générer la liste de TOUTES les dates entre start et end
        const dates = [];
        const recettes = [];
        const depenses = [];
        const balances = [];

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            // Utiliser le format local pour la clé de date (YYYY-MM-DD)
            const dateStr = d.toLocaleDateString('fr-CA'); // Format YYYY-MM-DD standard
            dates.push(dateStr);

            const dayData = this.data[dateStr];
            if (dayData) {
                // Calculer les recettes et dépenses pour cette date
                let net = 0;
                let totalDep = 0;
                
                // Sécuriser l'accès aux données (évite le crash si données incomplètes)
                const liv = dayData.liv || {};
                const dep = dayData.dep || {};

                // Calcul des livraisons
                [1000, 1500, 2000, 2500].forEach(val => {
                    const qty = Math.max(0, parseInt(liv[`l${val}`]) || 0);
                    const ech = Math.min(qty, Math.max(0, parseInt(liv[`e${val}`]) || 0));
                    const reussies = qty - ech;
                    const margPct = (parseFloat(liv[`m${val}`]) || this.defaultMargin()) / 100;
                    net += (reussies * val) * margPct;
                });

                // Calcul des dépenses
                totalDep += parseFloat(dep.carF) || 0;
                totalDep += parseFloat(dep.maint) || 0;
                totalDep += parseFloat(dep.fixes) || 0;
                if(dep.divers) {
                    dep.divers.forEach(div => {
                        totalDep += parseFloat(div.mt) || 0;
                    });
                }

                recettes.push(net);
                depenses.push(totalDep);
                balances.push(net - totalDep);
            } else {
                // Si pas de données, on met 0 pour garder la courbe continue
                recettes.push(0);
                depenses.push(0);
                balances.push(0);
            }
        }

        // Créer le graphique
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            console.error('Impossible de récupérer le contexte 2D du canvas');
            return;
        }

        // Configuration des couleurs pour le thème sombre
        // Configuration des couleurs pour le thème clair
        if (Chart.defaults) {
            Chart.defaults.color = '#6b7280'; // text-gray-500
            Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.05)';
        }

        window.mainEvolutionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => {
                    // Créer la date en ajoutant l'heure midi pour éviter le décalage de fuseau horaire
                    const d = new Date(date + 'T12:00:00');
                    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                }),
                datasets: [
                    {
                        label: 'Recettes (FCFA)',
                        data: recettes,
                        borderColor: '#10b981', // emerald-500
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderWidth: 3,
                        pointBackgroundColor: '#10b981',
                        tension: 0.4
                    },
                    {
                        label: 'Dépenses (FCFA)',
                        data: depenses,
                        borderColor: '#ef4444', // red-500
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderWidth: 3,
                        pointBackgroundColor: '#ef4444',
                        tension: 0.4
                    },
                    {
                        label: 'Bénéfice (FCFA)',
                        data: balances,
                        borderColor: '#3b82f6', // blue-500
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderWidth: 3,
                        pointBackgroundColor: '#3b82f6',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { 
                            color: '#1f2937', // text-gray-800
                            font: { size: 12, weight: 'bold' },
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)', // Keep tooltip dark for contrast
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('fr-FR').format(Math.round(context.parsed.y)) + ' FCFA';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#4b5563' }, // text-gray-600
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            color: '#4b5563', // text-gray-600
                            callback: function(value) {
                                return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
                            }
                        }
                    }
                }
            }
        });
        
        console.log('Graphique créé avec succès');
    }

    refreshMainChart() {
        this.initMainChart();
    }

    // Méthodes Firebase pour la synchronisation
    initFirebase() {
        console.log('🔥 Initialisation de Firebase...');
        
        // Écouter les changements d'authentification
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('✅ Utilisateur Firebase connecté:', user.email);
                // Attendre un peu avant de synchroniser
                setTimeout(() => {
                    this.syncFromFirebase();
                }, 2000);
            } else {
                console.log('❌ Utilisateur Firebase déconnecté, tentative de connexion...');
                // Se connecter automatiquement
                this.autoConnectToFirebase();
            }
        });
    }

    async autoConnectToFirebase() {
        try {
            // On utilise votre vrai mail enregistré dans Firebase
            const email = "nanouaboyaguy@gmail.com"; 
            const password = "winner123"; // ⚠️ Assurez-vous que ce mot de passe est celui défini dans Firebase Auth

            console.log('🔑 Tentative de connexion Firebase pour:', email);
            
            await auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Connexion Firebase réussie !');
            
        } catch (error) {
            console.log('⚠️ Erreur de connexion Firebase:', error.code, error.message);
            
            // Si le mot de passe est faux ou l'utilisateur n'existe pas
            if (error.code === 'auth/wrong-password') {
                console.error("❌ Le mot de passe dans le code ne correspond pas à celui de la console Firebase.");
            }
        }
    }

    async registerFirebaseUser() {
        try {
            let username = sessionStorage.getItem('username') || 'admin';
            const email = username.includes('@') ? username : `${username.toLowerCase()}@winner.com`;
            await auth.createUserWithEmailAndPassword(email, "winner123");
            console.log('👤 Nouveau compte Firebase créé automatiquement:', email);
        } catch (e) {
            console.error('❌ Impossible de créer le compte Firebase:', e.message);
        }
    }

    async syncFromFirebase() {
        try {
            console.log('🔥 Début chargement depuis Firebase...');
            
            const user = auth.currentUser;
            if (!user) {
                console.log('❌ Pas d\'utilisateur Firebase connecté, on réessaye dans 2 secondes...');
                // Réessayer après 2 secondes
                setTimeout(() => {
                    this.syncFromFirebase();
                }, 2000);
                return;
            }

            console.log('👤 Utilisateur Firebase:', user.email, 'UID:', user.uid);

            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                // Synchroniser les deux modes depuis Firebase
                const modes = [
                    { field: 'deliveryData',    storageKey: 'deliveryHistoricalData' },
                    { field: 'utbDeliveryData', storageKey: 'utbHistoricalData' }
                ];

                for (const m of modes) {
                    const firebaseData = doc.data()[m.field] || {};
                    const localData = JSON.parse(localStorage.getItem(m.storageKey)) || {};
                    const mergedData = { ...localData, ...firebaseData };
                    localStorage.setItem(m.storageKey, JSON.stringify(mergedData));
                    console.log(`✅ Mode ${m.field} synchronisé (${Object.keys(mergedData).length} jours)`);
                }

                // Synchroniser les données livreurs
                const fbLivreurs = doc.data().livreursList;
                if (fbLivreurs) localStorage.setItem('livreursList', JSON.stringify(fbLivreurs));

                const fbLivDaily = doc.data().livreursDailyData;
                if (fbLivDaily) {
                    const localDaily  = JSON.parse(localStorage.getItem('livreursDailyData')) || {};
                    localStorage.setItem('livreursDailyData', JSON.stringify({ ...localDaily, ...fbLivDaily }));
                }

                const fbPrimes = doc.data().livreursPrimes;
                if (fbPrimes) {
                    const localPrimes = JSON.parse(localStorage.getItem('livreursPrimes')) || {};
                    localStorage.setItem('livreursPrimes', JSON.stringify({ ...localPrimes, ...fbPrimes }));
                }

                console.log('✅ Données livreurs synchronisées depuis Firebase');

                // Recharger les données du mode actif
                this.data = JSON.parse(localStorage.getItem(this.getStorageKey())) || {};

                if (document.getElementById('liv-1000')) {
                    this.loadDateData(this.currentDate);
                }

                // Rafraîchir l'affichage livreurs si actif
                if (this.currentMode === 'livreurs') {
                    this.renderLivreursList();
                    this.renderLivreursDailyTable();
                }
            } else {
                console.log('📭 Aucune donnée trouvée dans Firebase pour cet utilisateur');
            }
        } catch (error) {
            console.error('❌ Erreur de synchronisation depuis Firebase:', error);
            
            // Si c'est une erreur de permissions, on continue en mode local
            if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
                console.warn('⚠️ Permissions Firebase insuffisantes, mode local uniquement');
                // Ne pas afficher d'alerte, continuer en mode local
                return;
            }
            
            alert('Erreur de chargement: ' + error.message);
        }
    }

    async syncToFirebase() {
        try {
            console.log('🔥 Début synchronisation vers Firebase...');
            
            // 1. On vérifie si l'utilisateur est déjà là
            let user = auth.currentUser;

            // 2. Si non, on tente de se reconnecter et on attend un peu
            if (!user) {
                console.log('🔄 Utilisateur non détecté, tentative de reconnexion forcée...');
                await this.autoConnectToFirebase();
                
                // On attend 2 secondes que Firebase stabilise la session
                await new Promise(resolve => setTimeout(resolve, 2000));
                user = auth.currentUser;
            }

            // 3. Si après l'attente c'est toujours vide, on arrête
            if (!user) {
                console.error('❌ Échec critique : Aucun utilisateur Firebase après attente.');
                alert("Erreur : Impossible de synchroniser. L'utilisateur nanouaboyaguy@gmail.com n'est pas connecté.");
                return;
            }

            // 4. Si on a le user, on envoie les données du mode actif
            const currentData = JSON.parse(localStorage.getItem(this.getStorageKey())) || {};
            const firebaseField = this.getFirebaseField();
            console.log(`📊 Données [${this.currentMode}] à synchroniser:`, currentData);

            await db.collection('users').doc(user.uid).set({
                [firebaseField]: currentData,
                lastSync: new Date().toISOString(),
                email: user.email
            }, { merge: true });
            
            console.log('✅ Données synchronisées avec succès pour:', user.email);
            this.showSyncStatus();
            
        } catch (error) {
            console.error('❌ Erreur Firestore:', error);
            
            // Si c'est une erreur de permissions, on continue en mode local
            if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
                console.warn('⚠️ Permissions Firebase insuffisantes, sauvegarde locale uniquement');
                // Ne pas afficher d'alerte, continuer en mode local
                this.showSyncStatus(); // Montrer que la sauvegarde locale a fonctionné
                return;
            }
            
            alert('Erreur de synchronisation : ' + error.message);
        }
    }

    showSyncStatus() {
        // Créer une notification de synchronisation
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in';
        notification.innerHTML = '<i class="fas fa-cloud-upload-alt mr-2"></i>Données synchronisées';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Modifier la méthode save pour inclure la synchronisation
    async saveWithSync() {
        this.save();
        await this.syncToFirebase();
    }

    // Méthodes pour les graphiques
    loadChartData() {
        console.log('Chargement des données pour les graphiques...');

        // Lire les données du mode actif
        const activeData = JSON.parse(localStorage.getItem(this.getStorageKey())) || {};

        // Préparer les données pour les graphiques
        const dates = Object.keys(activeData).sort();
        const recettes = [];
        const livraisons = [];
        const depenses = [];
        const balances = [];

        dates.forEach(date => {
            const dayData = activeData[date];
            if (dayData) {
                // Calculer les recettes et dépenses pour cette date
                let net = 0;
                let totalDep = 0;
                let totalLiv = 0;

                // Calcul des livraisons
                [1000, 1500, 2000, 2500].forEach(val => {
                    const qty = Math.max(0, parseInt(dayData.liv['l' + val]) || 0);
                    const ech = Math.min(qty, Math.max(0, parseInt(dayData.liv['e' + val]) || 0));
                    const reussies = qty - ech;
                    const margPct = (parseFloat(dayData.liv['m' + val]) || this.defaultMargin()) / 100;
                    net += (reussies * val) * margPct;
                    totalLiv += qty;
                });

                // Calcul des dépenses
                totalDep += parseFloat(dayData.dep.carF) || 0;
                totalDep += parseFloat(dayData.dep.maint) || 0;
                totalDep += parseFloat(dayData.dep.fixes) || 0;
                if(dayData.dep.divers) {
                    dayData.dep.divers.forEach(div => {
                        totalDep += parseFloat(div.mt) || 0;
                    });
                }

                recettes.push(net);
                livraisons.push(totalLiv);
                depenses.push(totalDep);
                balances.push(net - totalDep);
            } else {
                recettes.push(0);
                livraisons.push(0);
                depenses.push(0);
                balances.push(0);
            }
        });

        console.log('Dates trouvées:', dates);
        console.log('Données préparées:', { dates, recettes, livraisons, depenses, balances });

        // Sauvegarder les données pour les graphiques
        const chartData = { dates, recettes, livraisons, depenses, balances };
        localStorage.setItem('deliveryChartData', JSON.stringify(chartData));

        // Initialiser les graphiques si on est sur la page graphiques.html
        if (typeof Chart !== 'undefined') {
            this.initializeCharts();
        } else {
            console.log('Chart.js non disponible, initialisation différée');
        }
    }

    initializeCharts() {
        console.log('Initialisation des graphiques...');
        
        // Vérifier si nous sommes sur la page graphiques.html
        if (!document.getElementById('recettesChart')) {
            console.log('Page graphiques.html non détectée');
            return;
        }

        // Récupérer les données préparées
        const chartData = JSON.parse(localStorage.getItem('deliveryChartData') || '{}');
        const { dates, recettes, livraisons, depenses, balances } = chartData;

        if (!dates || dates.length === 0) {
            console.log('Pas de données pour les graphiques, création de données de test...');
            // Créer des données de test pour démonstration
            const testData = this.generateTestData();
            dates.push(...testData.dates);
            recettes.push(...testData.recettes);
            livraisons.push(...testData.livraisons);
            depenses.push(...testData.depenses);
            balances.push(...testData.balances);
        }

        console.log('Données finales pour graphiques:', { dates, recettes, livraisons, depenses, balances });

        // Détruire les graphiques existants
        ['recettesChart', 'livraisonsChart', 'depensesChart', 'balanceChart'].forEach(chartId => {
            if (window[chartId]) {
                window[chartId].destroy();
            }
        });

        // Options communes pour tous les graphiques
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            color: '#6b7280', // text-gray-500
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#1f2937' } // text-gray-800
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('fr-FR').format(Math.round(context.parsed.y)) + ' FCFA';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        color: '#4b5563', // text-gray-600
                        callback: function(value) {
                            return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
                        }
                    }
                },
                x: {
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#4b5563' } // text-gray-600
                }
            }
        };

        try {
            // Graphique des recettes
            const recettesCtx = document.getElementById('recettesChart').getContext('2d');
            window.recettesChart = new Chart(recettesCtx, {
                type: 'line',
                data: {
                    labels: dates.map(date => {
                        const d = new Date(date);
                        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    }),
                    datasets: [{
                        label: 'Recettes Nettes',
                        data: recettes,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.4
                    }]
                },
                options: chartOptions
            });
            console.log('Graphique recettes créé avec succès');

            // Graphique des livraisons
            const livraisonsCtx = document.getElementById('livraisonsChart').getContext('2d');
            window.livraisonsChart = new Chart(livraisonsCtx, {
                type: 'bar',
                data: {
                    labels: dates.map(date => {
                        const d = new Date(date);
                        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    }),
                    datasets: [{
                        label: 'Nombre de Livraisons',
                        data: livraisons,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1
                    }]
                },
                options: chartOptions
            });
            console.log('Graphique livraisons créé avec succès');

            // Graphique des dépenses
            const depensesCtx = document.getElementById('depensesChart').getContext('2d');
            window.depensesChart = new Chart(depensesCtx, {
                type: 'line',
                data: {
                    labels: dates.map(date => {
                        const d = new Date(date);
                        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    }),
                    datasets: [{
                        label: 'Dépenses Totales',
                        data: depenses,
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4
                    }]
                },
                options: chartOptions
            });
            console.log('Graphique dépenses créé avec succès');

            // Graphique de balance
            const balanceCtx = document.getElementById('balanceChart').getContext('2d');
            window.balanceChart = new Chart(balanceCtx, {
                type: 'line',
                data: {
                    labels: dates.map(date => {
                        const d = new Date(date);
                        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                    }),
                    datasets: [{
                        label: 'Bénéfice Net',
                        data: balances,
                        borderColor: balances.map(b => b >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'),
                        backgroundColor: balances.map(b => b >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                        tension: 0.4
                    }]
                },
                options: chartOptions
            });
            console.log('Graphique balance créé avec succès');
        } catch (error) {
            console.error('Erreur création graphiques:', error);
        }
    }

    // ─── Rapport Mensuel ─────────────────────────────────────────────────────

    showMonthlyReportModal() {
        const modal = document.getElementById('monthly-modal');
        const modeLabel = document.getElementById('modal-mode-label');
        const header = document.getElementById('modal-header');
        const yearInput = document.getElementById('report-year');
        const monthInput = document.getElementById('report-month');

        // Titre et couleur selon le mode actif
        if (this.currentMode === 'utb') {
            modeLabel.textContent = 'UTB';
            header.style.backgroundColor = '#ea580c';
        } else {
            modeLabel.textContent = 'Clients Généraux';
            header.style.backgroundColor = '#059669';
        }

        // Pré-remplir avec le mois en cours
        const now = new Date();
        yearInput.value = now.getFullYear();
        monthInput.value = now.getMonth() + 1;

        // Réinitialiser le contenu
        document.getElementById('monthly-kpi').classList.add('hidden');
        document.getElementById('monthly-table-container').innerHTML = `
            <p class="text-gray-400 text-center py-12">
                <i class="fas fa-calendar-alt text-4xl mb-3 block opacity-30"></i>
                Sélectionnez un mois et cliquez sur "Afficher"
            </p>`;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Fermer avec Échap
        this._escHandler = (e) => { if (e.key === 'Escape') this.closeMonthlyModal(); };
        document.addEventListener('keydown', this._escHandler);
    }

    closeMonthlyModal() {
        const modal = document.getElementById('monthly-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    }

    _getMonthStats(year, month) {
        const activeData = JSON.parse(localStorage.getItem(this.getStorageKey())) || {};
        const days = [];

        // Itérer sur tous les jours du mois
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayData = activeData[dateStr];
            if (!dayData) continue;

            const liv = dayData.liv || {};
            const dep = dayData.dep || {};

            let totalLiv = 0, totalEch = 0, brut = 0, net = 0, totalDep = 0;

            [1000, 1500, 2000, 2500].forEach(val => {
                const qty  = Math.max(0, parseInt(liv[`l${val}`]) || 0);
                const ech  = Math.min(qty, Math.max(0, parseInt(liv[`e${val}`]) || 0));
                const ok   = qty - ech;
                const marg = (parseFloat(liv[`m${val}`]) || this.defaultMargin()) / 100;
                totalLiv += qty;
                totalEch += ech;
                brut     += ok * val;
                net      += ok * val * marg;
            });

            totalDep += parseFloat(dep.carF)   || 0;
            totalDep += parseFloat(dep.maint)  || 0;
            totalDep += parseFloat(dep.fixes)  || 0;
            (dep.divers || []).forEach(div => { totalDep += parseFloat(div.mt) || 0; });

            days.push({ dateStr, totalLiv, totalEch, brut, net, totalDep, balance: net - totalDep, obs: dayData.obs || '' });
        }

        // Totaux
        const totaux = days.reduce((acc, d) => ({
            totalLiv:  acc.totalLiv  + d.totalLiv,
            totalEch:  acc.totalEch  + d.totalEch,
            brut:      acc.brut      + d.brut,
            net:       acc.net       + d.net,
            totalDep:  acc.totalDep  + d.totalDep,
            balance:   acc.balance   + d.balance
        }), { totalLiv:0, totalEch:0, brut:0, net:0, totalDep:0, balance:0 });

        return { days, totaux };
    }

    generateMonthlyPreview() {
        const year  = parseInt(document.getElementById('report-year').value);
        const month = parseInt(document.getElementById('report-month').value);
        if (!year || !month) return;

        const { days, totaux } = this._getMonthStats(year, month);

        // Mettre à jour les KPIs
        const kpiSection = document.getElementById('monthly-kpi');
        kpiSection.classList.remove('hidden');
        document.getElementById('kpi-jours').textContent    = days.length;
        document.getElementById('kpi-recettes').textContent = this.formatFCFA(totaux.net);
        document.getElementById('kpi-depenses').textContent = this.formatFCFA(totaux.totalDep);
        const kpiBenef = document.getElementById('kpi-benefice');
        kpiBenef.textContent  = this.formatFCFA(totaux.balance);
        kpiBenef.className    = `text-2xl font-black mt-1 ${totaux.balance >= 0 ? 'text-purple-700' : 'text-red-600'}`;

        const container = document.getElementById('monthly-table-container');

        if (days.length === 0) {
            container.innerHTML = `<p class="text-gray-400 text-center py-12"><i class="fas fa-inbox text-4xl mb-3 block opacity-30"></i>Aucune donnée pour ce mois</p>`;
            return;
        }

        const moisNom = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const modeLabel = this.currentMode === 'utb' ? 'UTB' : 'Clients Généraux';

        let rows = days.map(d => {
            const dateFr = new Date(d.dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            const balColor = d.balance >= 0 ? 'text-green-600' : 'text-red-600';
            return `<tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td class="px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap">${dateFr}</td>
                <td class="px-3 py-2 text-sm text-center text-gray-600">${d.totalLiv}</td>
                <td class="px-3 py-2 text-sm text-center text-red-500">${d.totalEch}</td>
                <td class="px-3 py-2 text-sm text-center text-gray-500">${this.formatFCFA(d.brut)}</td>
                <td class="px-3 py-2 text-sm text-center text-green-600 font-semibold">${this.formatFCFA(d.net)}</td>
                <td class="px-3 py-2 text-sm text-center text-red-600">${this.formatFCFA(d.totalDep)}</td>
                <td class="px-3 py-2 text-sm text-center font-bold ${balColor}">${this.formatFCFA(d.balance)}</td>
            </tr>`;
        }).join('');

        const totBalColor = totaux.balance >= 0 ? 'text-green-700' : 'text-red-700';
        container.innerHTML = `
            <h3 class="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
                <i class="fas fa-table text-gray-400"></i>
                Détail journalier — ${moisNom} (${modeLabel})
            </h3>
            <div class="overflow-x-auto">
                <table class="w-full text-xs">
                    <thead>
                        <tr class="bg-gray-100 text-gray-600 uppercase text-xs">
                            <th class="px-3 py-2 text-left rounded-tl-lg">Date</th>
                            <th class="px-3 py-2 text-center">Livraisons</th>
                            <th class="px-3 py-2 text-center">Échecs</th>
                            <th class="px-3 py-2 text-center">Brut</th>
                            <th class="px-3 py-2 text-center">Nettes</th>
                            <th class="px-3 py-2 text-center">Dépenses</th>
                            <th class="px-3 py-2 text-center rounded-tr-lg">Bénéfice</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr class="bg-gray-50 font-bold border-t-2 border-gray-300">
                            <td class="px-3 py-3 text-sm text-gray-800">TOTAL (${days.length} jours)</td>
                            <td class="px-3 py-3 text-sm text-center text-gray-700">${totaux.totalLiv}</td>
                            <td class="px-3 py-3 text-sm text-center text-red-500">${totaux.totalEch}</td>
                            <td class="px-3 py-3 text-sm text-center text-gray-600">${this.formatFCFA(totaux.brut)}</td>
                            <td class="px-3 py-3 text-sm text-center text-green-700">${this.formatFCFA(totaux.net)}</td>
                            <td class="px-3 py-3 text-sm text-center text-red-600">${this.formatFCFA(totaux.totalDep)}</td>
                            <td class="px-3 py-3 text-sm text-center ${totBalColor}">${this.formatFCFA(totaux.balance)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }

    downloadMonthlyReport() {
        const year  = parseInt(document.getElementById('report-year').value);
        const month = parseInt(document.getElementById('report-month').value);
        if (!year || !month) return;

        const { days, totaux } = this._getMonthStats(year, month);
        const moisNom   = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const modeLabel = this.currentMode === 'utb' ? 'UTB' : 'Clients Généraux';
        const heure     = new Date().toLocaleTimeString('fr-FR');

        if (days.length === 0) {
            alert(`Aucune donnée pour ${moisNom} — ${modeLabel}`);
            return;
        }

        const sep = '='.repeat(60);
        const line = '-'.repeat(60);

        let rapport = `${sep}
   RAPPORT MENSUEL — WINNER EXPRESS
   Mode : ${modeLabel}
   Période : ${moisNom.toUpperCase()}
   Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${heure}
${sep}

`;

        rapport += `RÉCAPITULATIF DU MOIS
${line}
Jours actifs       : ${days.length}
Total livraisons   : ${totaux.totalLiv}
Total échecs       : ${totaux.totalEch}
Livraisons réussies: ${totaux.totalLiv - totaux.totalEch}
${line}
Recettes brutes    : ${this.formatFCFA(totaux.brut)}
Recettes nettes    : ${this.formatFCFA(totaux.net)}
Total dépenses     : ${this.formatFCFA(totaux.totalDep)}
${line}
BÉNÉFICE NET       : ${this.formatFCFA(totaux.balance)}
${totaux.balance >= 0 ? '✅ MOIS RENTABLE' : '❌ MOIS DÉFICITAIRE'}

`;

        rapport += `${sep}
DÉTAIL JOURNALIER
${sep}
${'Date'.padEnd(15)} ${'Livr.'.padStart(6)} ${'Éch.'.padStart(5)} ${'Nettes'.padStart(14)} ${'Dépenses'.padStart(14)} ${'Bénéfice'.padStart(14)}
${line}
`;

        days.forEach(d => {
            const dateFr = new Date(d.dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
            rapport += `${dateFr.padEnd(15)} ${String(d.totalLiv).padStart(6)} ${String(d.totalEch).padStart(5)} ${this.formatFCFA(d.net).padStart(14)} ${this.formatFCFA(d.totalDep).padStart(14)} ${this.formatFCFA(d.balance).padStart(14)}\n`;
        });

        rapport += `${line}
${'TOTAL'.padEnd(15)} ${String(totaux.totalLiv).padStart(6)} ${String(totaux.totalEch).padStart(5)} ${this.formatFCFA(totaux.net).padStart(14)} ${this.formatFCFA(totaux.totalDep).padStart(14)} ${this.formatFCFA(totaux.balance).padStart(14)}
${sep}
`;

        const blob = new Blob(['\uFEFF' + rapport], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const moisSlug = `${year}-${String(month).padStart(2,'0')}`;
        link.download = `Winner_Express_Rapport_Mensuel_${modeLabel.replace(' ','_')}_${moisSlug}.txt`;
        link.click();
    }

    downloadMonthlyReportPDF() {
        const year  = parseInt(document.getElementById('report-year').value);
        const month = parseInt(document.getElementById('report-month').value);
        if (!year || !month) return;

        const { days, totaux } = this._getMonthStats(year, month);
        const moisNom   = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const modeLabel = this.currentMode === 'utb' ? 'UTB' : 'Clients Généraux';

        if (days.length === 0) {
            alert(`Aucune donnée pour ${moisNom} — ${modeLabel}`);
            return;
        }

        // Formateur sans espace insécable (évite les slashes dans jsPDF)
        const fmt = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const isUTB     = this.currentMode === 'utb';
        const colorMain = isUTB ? [234, 88, 12] : [16, 185, 129];   // orange-600 / emerald-500
        const colorDark = isUTB ? [154, 52, 18]  : [4, 120, 87];

        // ── En-tête ──────────────────────────────────────────────────────────
        doc.setFillColor(...colorMain);
        doc.rect(0, 0, 297, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('WINNER EXPRESS', 14, 11);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Rapport Mensuel — ${modeLabel}`, 14, 19);

        doc.setFontSize(10);
        doc.text(`Période : ${moisNom.toUpperCase()}`, 14, 25.5);

        // Date de génération (coin droit)
        const heure = new Date().toLocaleString('fr-FR');
        doc.setFontSize(8);
        doc.text(`Généré le ${heure}`, 297 - 14, 25.5, { align: 'right' });

        // ── Bande KPIs ───────────────────────────────────────────────────────
        const kpiY = 34;
        const kpis = [
            { label: 'Jours actifs',    value: String(days.length),              bg: [239,246,255], border: [147,197,253] },
            { label: 'Livraisons',      value: String(totaux.totalLiv),           bg: [240,253,244], border: [134,239,172] },
            { label: 'Recettes Nettes', value: fmt(totaux.net),       bg: [240,253,244], border: [134,239,172] },
            { label: 'Dépenses',        value: fmt(totaux.totalDep),  bg: [255,241,242], border: [252,165,165] },
            { label: 'Bénéfice Net',    value: fmt(totaux.balance),   bg: totaux.balance >= 0 ? [240,253,244] : [255,241,242], border: totaux.balance >= 0 ? [134,239,172] : [252,165,165] },
        ];

        const kpiW = (297 - 28 - 4 * 4) / 5;
        kpis.forEach((k, i) => {
            const x = 14 + i * (kpiW + 4);
            doc.setFillColor(...k.bg);
            doc.setDrawColor(...k.border);
            doc.roundedRect(x, kpiY, kpiW, 16, 2, 2, 'FD');
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(k.label.toUpperCase(), x + kpiW / 2, kpiY + 5, { align: 'center' });
            doc.setTextColor(30, 30, 30);
            doc.setFontSize(9);
            doc.text(k.value, x + kpiW / 2, kpiY + 12, { align: 'center' });
        });

        // ── Tableau ───────────────────────────────────────────────────────────
        const tableRows = days.map(d => {
            const dateFr = new Date(d.dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
            return [
                dateFr,
                d.totalLiv,
                d.totalEch,
                d.totalLiv - d.totalEch,
                fmt(d.brut),
                fmt(d.net),
                fmt(d.totalDep),
                fmt(d.balance)
            ];
        });

        tableRows.push([
            { content: `TOTAL (${days.length} jours)`, styles: { fontStyle: 'bold' } },
            { content: totaux.totalLiv, styles: { fontStyle: 'bold' } },
            { content: totaux.totalEch, styles: { fontStyle: 'bold', textColor: [220,38,38] } },
            { content: totaux.totalLiv - totaux.totalEch, styles: { fontStyle: 'bold' } },
            { content: fmt(totaux.brut), styles: { fontStyle: 'bold' } },
            { content: fmt(totaux.net), styles: { fontStyle: 'bold', textColor: [22,163,74] } },
            { content: fmt(totaux.totalDep), styles: { fontStyle: 'bold', textColor: [220,38,38] } },
            { content: fmt(totaux.balance), styles: { fontStyle: 'bold', textColor: totaux.balance >= 0 ? [22,163,74] : [220,38,38] } },
        ]);

        doc.autoTable({
            startY: kpiY + 22,
            head: [['Date', 'Livraisons', 'Échecs', 'Réussies', 'Brutes', 'Nettes', 'Dépenses', 'Bénéfice']],
            body: tableRows,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
            headStyles: { fillColor: colorDark, textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' },
                4: { halign: 'right'  }, 5: { halign: 'right'  }, 6: { halign: 'right' }, 7: { halign: 'right' }
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 7 && data.row.index < days.length) {
                    const bal = days[data.row.index].balance;
                    data.cell.styles.textColor = bal >= 0 ? [22,163,74] : [220,38,38];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // ── Pied de page ─────────────────────────────────────────────────────
        const pageH = doc.internal.pageSize.height;
        doc.setFillColor(...colorMain);
        doc.rect(0, pageH - 10, 297, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text('WINNER EXPRESS — Rapport confidentiel', 14, pageH - 3.5);
        doc.text(`${moisNom} • ${modeLabel}`, 297 - 14, pageH - 3.5, { align: 'right' });

        const moisSlug = `${year}-${String(month).padStart(2,'0')}`;
        doc.save(`Winner_Express_Rapport_${modeLabel.replace(' ','_')}_${moisSlug}.pdf`);
    }

    // ─── Sync Firebase Livreurs ───────────────────────────────────────────────

    async loadLivreursFromFirebase() {
        // Attendre que Firebase Auth soit prêt (jusqu'à 10 secondes)
        const user = await new Promise((resolve) => {
            if (auth.currentUser) { resolve(auth.currentUser); return; }
            let tries = 0;
            const interval = setInterval(() => {
                tries++;
                if (auth.currentUser) { clearInterval(interval); resolve(auth.currentUser); }
                else if (tries >= 20) { clearInterval(interval); resolve(null); }
            }, 500);
        });

        if (!user) {
            console.warn('⚠️ loadLivreursFromFirebase : aucun utilisateur Firebase après 10s');
            return;
        }

        try {
            console.log('🔄 Chargement livreurs depuis Firebase pour', user.email);
            const doc = await db.collection('users').doc(user.uid).get();
            if (!doc.exists) { console.log('📭 Aucun document Firebase pour cet utilisateur'); return; }

            const data = doc.data();
            console.log('📥 Champs livreurs dans Firebase:', Object.keys(data).filter(k => k.startsWith('livreur')));

            if (data.livreursList) {
                localStorage.setItem('livreursList', JSON.stringify(data.livreursList));
                console.log('✅ livreursList chargé :', data.livreursList.length, 'livreurs');
            }
            if (data.livreursDailyData) {
                const local = JSON.parse(localStorage.getItem('livreursDailyData')) || {};
                localStorage.setItem('livreursDailyData', JSON.stringify({ ...local, ...data.livreursDailyData }));
                console.log('✅ livreursDailyData chargé :', Object.keys(data.livreursDailyData).length, 'jours');
            }
            if (data.livreursPrimes) {
                const local = JSON.parse(localStorage.getItem('livreursPrimes')) || {};
                localStorage.setItem('livreursPrimes', JSON.stringify({ ...local, ...data.livreursPrimes }));
            }

            this.renderLivreursList();
            this.renderLivreursDailyTable();
        } catch (e) {
            console.error('❌ Erreur chargement livreurs Firebase:', e);
        }
    }

    async syncLivreursToFirebase() {
        const user = await new Promise((resolve) => {
            if (auth.currentUser) { resolve(auth.currentUser); return; }
            let tries = 0;
            const interval = setInterval(() => {
                tries++;
                if (auth.currentUser) { clearInterval(interval); resolve(auth.currentUser); }
                else if (tries >= 20) { clearInterval(interval); resolve(null); }
            }, 500);
        });

        if (!user) { console.error('❌ Sync livreurs impossible : utilisateur non connecté après 10s'); return; }

        try {
            const livreurs   = this.getLivreurs();
            const dailyData  = this.getLivreursDailyData();
            const primes     = this.getLivreursPrimes();

            console.log('🔄 Sync livreurs vers Firebase — livreurs:', livreurs.length, '| jours:', Object.keys(dailyData).length);

            await db.collection('users').doc(user.uid).set({
                livreursList:      livreurs,
                livreursDailyData: dailyData,
                livreursPrimes:    primes,
                lastSync:          new Date().toISOString()
            }, { merge: true });

            console.log('✅ Livreurs synchronisés vers Firebase avec succès');
            this.showSyncStatus();
        } catch (error) {
            console.error('❌ Erreur sync livreurs Firebase:', error);
            alert('Erreur de synchronisation livreurs : ' + error.message);
        }
    }

    // ─── Gestion Livreurs ─────────────────────────────────────────────────────

    getLivreurs() {
        return JSON.parse(localStorage.getItem('livreursList')) || [];
    }

    saveLivreurs(list) {
        localStorage.setItem('livreursList', JSON.stringify(list));
    }

    getLivreursDailyData() {
        return JSON.parse(localStorage.getItem('livreursDailyData')) || {};
    }

    saveLivreursDailyData(data) {
        localStorage.setItem('livreursDailyData', JSON.stringify(data));
    }

    getLivreursPrimes() {
        return JSON.parse(localStorage.getItem('livreursPrimes')) || {};
    }

    saveLivreursPrimes(data) {
        localStorage.setItem('livreursPrimes', JSON.stringify(data));
    }

    async addLivreur() {
        const input = document.getElementById('new-livreur-nom');
        const nom = input.value.trim();
        if (!nom) return;
        const livreurs = this.getLivreurs();
        livreurs.push({ id: 'liv_' + Date.now(), nom, actif: true });
        this.saveLivreurs(livreurs);
        input.value = '';
        this.renderLivreursList();
        this.renderLivreursDailyTable();
        await this.syncLivreursToFirebase();
    }

    toggleLivreur(id) {
        const livreurs = this.getLivreurs();
        const l = livreurs.find(l => l.id === id);
        if (l) { l.actif = !l.actif; this.saveLivreurs(livreurs); }
        this.renderLivreursList();
        this.renderLivreursDailyTable();
    }

    async deleteLivreur(id) {
        if (!confirm('Supprimer ce livreur définitivement ?')) return;
        this.saveLivreurs(this.getLivreurs().filter(l => l.id !== id));
        this.renderLivreursList();
        this.renderLivreursDailyTable();
        await this.syncLivreursToFirebase();
    }

    renderLivreursList() {
        const container = document.getElementById('livreurs-list');
        const countEl   = document.getElementById('livreurs-count');
        if (!container) return;
        const livreurs = this.getLivreurs();
        if (countEl) countEl.textContent = livreurs.filter(l => l.actif).length;
        if (livreurs.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Aucun livreur enregistré</p>';
            return;
        }
        container.innerHTML = livreurs.map(l => `
            <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background:#ede9fe;">
                        <i class="fas fa-motorcycle text-xs" style="color:#6d28d9;"></i>
                    </div>
                    <span class="font-medium text-gray-700 ${l.actif ? '' : 'line-through text-gray-400'}">${l.nom}</span>
                </div>
                <div class="flex gap-2 items-center">
                    <button onclick="dashboard.toggleLivreur('${l.id}')" class="text-xs px-2 py-1 rounded-lg font-semibold ${l.actif ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}">
                        ${l.actif ? 'Actif' : 'Inactif'}
                    </button>
                    <button onclick="dashboard.deleteLivreur('${l.id}')" class="text-red-400 hover:text-red-600 p-1 transition-colors">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>`).join('');
    }

    renderLivreursDailyTable() {
        const container = document.getElementById('livreurs-daily-table');
        if (!container) return;
        const date     = document.getElementById('livreur-date')?.value || this.currentDate;
        const livreurs = this.getLivreurs().filter(l => l.actif);
        const dayData  = (this.getLivreursDailyData()[date]) || {};

        if (livreurs.length === 0) {
            container.innerHTML = `<p class="text-gray-400 text-center py-8"><i class="fas fa-motorcycle text-4xl block mb-3 opacity-20"></i>Ajoutez des livreurs pour commencer</p>`;
            return;
        }

        container.innerHTML = `
            <table class="w-full">
                <thead>
                    <tr class="text-gray-600 text-sm uppercase" style="background:#f5f3ff;">
                        <th class="px-4 py-3 text-left rounded-tl-xl">Livreur</th>
                        <th class="px-4 py-3 text-center">Total</th>
                        <th class="px-4 py-3 text-center">Livrés</th>
                        <th class="px-4 py-3 text-center rounded-tr-xl">Retours</th>
                    </tr>
                </thead>
                <tbody>
                    ${livreurs.map(l => {
                        const d   = dayData[l.id] || { total: 0, livraisons: 0, retours: 0 };
                        const net = Math.max(0, d.livraisons - d.retours);
                        return `<tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-full flex items-center justify-center" style="background:#ede9fe;">
                                        <i class="fas fa-motorcycle text-xs" style="color:#6d28d9;"></i>
                                    </div>
                                    <span class="font-semibold text-gray-700">${l.nom}</span>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <input type="number" id="tot-day-${l.id}" value="${d.total || 0}" min="0"
                                    class="input-modern w-20 p-2 rounded-lg text-center text-sm"
                                    oninput="dashboard.updateLivreurSummary()">
                            </td>
                            <td class="px-4 py-3 text-center">
                                <input type="number" id="liv-day-${l.id}" value="${d.livraisons}" min="0"
                                    class="input-modern w-20 p-2 rounded-lg text-center text-sm"
                                    oninput="dashboard.updateLivreurSummary()">
                            </td>
                            <td class="px-4 py-3 text-center rounded-tr-xl">
                                <input type="number" id="ret-day-${l.id}" value="${d.retours}" min="0"
                                    class="input-modern w-20 p-2 rounded-lg text-center text-sm"
                                    oninput="dashboard.updateLivreurSummary()">
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        this.updateLivreurSummary();
    }

    updateLivreurSummary() {
        const livreurs = this.getLivreurs().filter(l => l.actif);
        let totalTot = 0, totalLiv = 0, totalRet = 0;
        livreurs.forEach(l => {
            const tot = parseInt(document.getElementById(`tot-day-${l.id}`)?.value) || 0;
            const liv = parseInt(document.getElementById(`liv-day-${l.id}`)?.value) || 0;
            const ret = parseInt(document.getElementById(`ret-day-${l.id}`)?.value) || 0;
            const net = Math.max(0, liv - ret);
            const netEl = document.getElementById(`net-day-${l.id}`);
            if (netEl) netEl.textContent = net;
            totalTot += tot;
            totalLiv += liv;
            totalRet += ret;
        });
        const sumLiv = document.getElementById('sum-livraisons');
        const sumRet = document.getElementById('sum-retours');
        const sumNet = document.getElementById('sum-net');
        if (sumLiv) sumLiv.textContent = totalLiv;
        if (sumRet) sumRet.textContent = totalRet;
        if (sumNet) sumNet.textContent = Math.max(0, totalLiv - totalRet);
    }

    async saveLivreurDay() {
        const date = document.getElementById('livreur-date')?.value;
        if (!date) return;
        const livreurs = this.getLivreurs().filter(l => l.actif);
        const allData  = this.getLivreursDailyData();
        const dayData  = {};
        livreurs.forEach(l => {
            const tot = parseInt(document.getElementById(`tot-day-${l.id}`)?.value) || 0;
            const liv = parseInt(document.getElementById(`liv-day-${l.id}`)?.value) || 0;
            const ret = parseInt(document.getElementById(`ret-day-${l.id}`)?.value) || 0;
            dayData[l.id] = { total: tot, livraisons: liv, retours: ret };
        });
        allData[date] = dayData;
        this.saveLivreursDailyData(allData);
        await this.syncLivreursToFirebase();
    }

    // ─── Rapport mensuel livreurs ─────────────────────────────────────────────

    showLivreurMonthlyModal() {
        const modal = document.getElementById('livreur-monthly-modal');
        const now   = new Date();
        document.getElementById('lrep-year').value  = now.getFullYear();
        document.getElementById('lrep-month').value = now.getMonth() + 1;
        document.getElementById('livreur-report-table').innerHTML = `
            <p class="text-gray-400 text-center py-12">
                <i class="fas fa-motorcycle text-4xl block mb-3 opacity-20"></i>
                Sélectionnez un mois et cliquez sur "Afficher"
            </p>`;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        this._escLivreur = (e) => { if (e.key === 'Escape') this.closeLivreurModal(); };
        document.addEventListener('keydown', this._escLivreur);
    }

    closeLivreurModal() {
        const modal = document.getElementById('livreur-monthly-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (this._escLivreur) { document.removeEventListener('keydown', this._escLivreur); this._escLivreur = null; }
    }

    _getLivreurMonthStats(year, month) {
        const allData  = this.getLivreursDailyData();
        const livreurs = this.getLivreurs();
        const daysInMonth = new Date(year, month, 0).getDate();
        // Accumulateurs par livreur
        const stats = {};
        livreurs.forEach(l => { stats[l.id] = { nom: l.nom, total: 0, livraisons: 0, retours: 0 }; });

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayData = allData[dateStr];
            if (!dayData) continue;
            livreurs.forEach(l => {
                const entry = dayData[l.id];
                if (entry) {
                    stats[l.id].total      += parseInt(entry.total)      || 0;
                    stats[l.id].livraisons += parseInt(entry.livraisons) || 0;
                    stats[l.id].retours    += parseInt(entry.retours)    || 0;
                }
            });
        }
        return livreurs.map(l => ({ ...stats[l.id], id: l.id, net: Math.max(0, stats[l.id].livraisons - stats[l.id].retours) }));
    }

    generateLivreurPreview() {
        const year  = parseInt(document.getElementById('lrep-year').value);
        const month = parseInt(document.getElementById('lrep-month').value);
        if (!year || !month) return;

        const stats    = this._getLivreurMonthStats(year, month);
        const moisNom  = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const primes   = this.getLivreursPrimes();
        const monthKey = `${year}-${String(month).padStart(2,'0')}`;
        const savedPrimes = primes[monthKey] || {};

        const hasData = stats.some(s => s.livraisons > 0);

        const container = document.getElementById('livreur-report-table');
        if (!hasData) {
            container.innerHTML = `<p class="text-gray-400 text-center py-12"><i class="fas fa-inbox text-4xl block mb-3 opacity-20"></i>Aucune donnée pour ${moisNom}</p>`;
            return;
        }

        const totalLiv = stats.reduce((a, s) => a + s.livraisons, 0);
        const totalRet = stats.reduce((a, s) => a + s.retours,    0);
        const totalNet = stats.reduce((a, s) => a + s.net,        0);

        container.innerHTML = `
            <h3 class="text-sm font-bold text-gray-600 mb-3">${moisNom.toUpperCase()} — Saisissez les primes puis cliquez "Sauver primes"</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-xs uppercase text-white" style="background:#6d28d9;">
                            <th class="px-4 py-3 text-left rounded-tl-lg">Livreur</th>
                            <th class="px-4 py-3 text-center">Total</th>
                            <th class="px-4 py-3 text-center">Livrés</th>
                            <th class="px-4 py-3 text-center">Retours</th>
                            <th class="px-4 py-3 text-center">Net</th>
                            <th class="px-4 py-3 text-center rounded-tr-lg">Prime (FCFA)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.map(s => `
                        <tr class="border-b border-gray-100 hover:bg-purple-50 transition-colors">
                            <td class="px-4 py-3 font-semibold text-gray-700">
                                <i class="fas fa-motorcycle mr-2 text-xs" style="color:#6d28d9;"></i>${s.nom}
                            </td>
                            <td class="px-4 py-3 text-center text-gray-600">${s.total}</td>
                            <td class="px-4 py-3 text-center text-gray-600">${s.livraisons}</td>
                            <td class="px-4 py-3 text-center text-red-500">${s.retours}</td>
                            <td class="px-4 py-3 text-center font-bold" style="color:#6d28d9;">${s.net}</td>
                            <td class="px-4 py-3 text-center">
                                <input type="number" id="prime-${s.id}" value="${savedPrimes[s.id] || ''}"
                                    class="input-modern w-32 p-2 rounded-lg text-center text-sm" placeholder="0">
                            </td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="font-bold bg-gray-50 border-t-2 border-gray-300">
                            <td class="px-4 py-3 text-gray-800">TOTAL</td>
                            <td class="px-4 py-3 text-center text-gray-700">${stats.reduce((a,s)=>a+s.total,0)}</td>
                            <td class="px-4 py-3 text-center text-gray-700">${totalLiv}</td>
                            <td class="px-4 py-3 text-center text-red-600">${totalRet}</td>
                            <td class="px-4 py-3 text-center" style="color:#6d28d9;">${totalNet}</td>
                            <td class="px-4 py-3 text-center text-gray-400 text-xs italic">saisie manuelle</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;

        // Stocker pour download
        this._livreurReportCache = { year, month, moisNom, stats, monthKey };
    }

    async saveLivreurPrimes() {
        if (!this._livreurReportCache) return;
        const { stats, monthKey } = this._livreurReportCache;
        const primes    = this.getLivreursPrimes();
        const monthData = {};
        stats.forEach(s => {
            const val = parseFloat(document.getElementById(`prime-${s.id}`)?.value) || 0;
            monthData[s.id] = val;
        });
        primes[monthKey] = monthData;
        this.saveLivreursPrimes(primes);
        await this.syncLivreursToFirebase();
    }

    downloadLivreurReportPDF() {
        if (!this._livreurReportCache) { alert('Cliquez d\'abord sur "Afficher"'); return; }
        const { year, month, moisNom, stats, monthKey } = this._livreurReportCache;
        const primes = (this.getLivreursPrimes()[monthKey]) || {};

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const fmt = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';

        // En-tête
        doc.setFillColor(109, 40, 217);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.text('WINNER EXPRESS', 14, 11);
        doc.setFontSize(11); doc.setFont('helvetica', 'normal');
        doc.text('Rapport Mensuel — Livreurs', 14, 19);
        doc.setFontSize(9);
        doc.text(`Periode : ${moisNom.toUpperCase()}`, 14, 25.5);
        doc.text(`Genere le ${new Date().toLocaleString('fr-FR')}`, 210 - 14, 25.5, { align: 'right' });

        // Tableau
        const totalPrime = stats.reduce((a, s) => a + (primes[s.id] || 0), 0);
        const rows = stats.map(s => [
            s.nom,
            s.total,
            s.livraisons,
            s.retours,
            s.net,
            primes[s.id] ? fmt(primes[s.id]) : '-'
        ]);
        rows.push([
            { content: 'TOTAL', styles: { fontStyle: 'bold' } },
            { content: stats.reduce((a,s)=>a+s.total,0), styles: { fontStyle: 'bold' } },
            { content: stats.reduce((a,s)=>a+s.livraisons,0), styles: { fontStyle: 'bold' } },
            { content: stats.reduce((a,s)=>a+s.retours,0), styles: { fontStyle: 'bold', textColor:[220,38,38] } },
            { content: stats.reduce((a,s)=>a+s.net,0), styles: { fontStyle: 'bold', textColor:[109,40,217] } },
            { content: fmt(totalPrime), styles: { fontStyle: 'bold', textColor:[22,163,74] } }
        ]);

        doc.autoTable({
            startY: 35,
            head: [['Livreur', 'Total', 'Livres', 'Retours', 'Net', 'Prime']],
            body: rows,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3, textColor: [50,50,50] },
            headStyles: { fillColor: [109,40,217], textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' }, 2: { halign: 'center' },
                3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right' }
            },
            alternateRowStyles: { fillColor: [245,243,255] },
        });

        // Pied
        const ph = doc.internal.pageSize.height;
        doc.setFillColor(109, 40, 217);
        doc.rect(0, ph - 10, 210, 10, 'F');
        doc.setTextColor(255,255,255); doc.setFontSize(7);
        doc.text('WINNER EXPRESS — Confidentiel', 14, ph - 3.5);
        doc.text(`${moisNom} • Livreurs`, 210 - 14, ph - 3.5, { align: 'right' });

        doc.save(`Winner_Express_Livreurs_${year}-${String(month).padStart(2,'0')}.pdf`);
    }

    downloadLivreurReportTxt() {
        if (!this._livreurReportCache) { alert('Cliquez d\'abord sur "Afficher"'); return; }
        const { year, month, moisNom, stats, monthKey } = this._livreurReportCache;
        const primes = (this.getLivreursPrimes()[monthKey]) || {};
        const fmt    = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
        const sep    = '='.repeat(55);
        const line   = '-'.repeat(55);
        const heure  = new Date().toLocaleTimeString('fr-FR');

        let txt = `${sep}\n   RAPPORT MENSUEL LIVREURS — WINNER EXPRESS\n   Periode : ${moisNom.toUpperCase()}\n   Genere le : ${new Date().toLocaleDateString('fr-FR')} a ${heure}\n${sep}\n\n`;
        txt += `${'Livreur'.padEnd(20)} ${'Total'.padStart(6)} ${'Livr.'.padStart(6)} ${'Ret.'.padStart(6)} ${'Net'.padStart(6)} ${'Prime'.padStart(14)}\n${line}\n`;
        stats.forEach(s => {
            const prime = primes[s.id] ? fmt(primes[s.id]) : '-';
            txt += `${s.nom.padEnd(20)} ${String(s.total).padStart(6)} ${String(s.livraisons).padStart(6)} ${String(s.retours).padStart(6)} ${String(s.net).padStart(6)} ${prime.padStart(14)}\n`;
        });
        const totalPrime = stats.reduce((a,s)=>a+(primes[s.id]||0), 0);
        txt += `${line}\n${'TOTAL'.padEnd(20)} ${String(stats.reduce((a,s)=>a+s.total,0)).padStart(6)} ${String(stats.reduce((a,s)=>a+s.livraisons,0)).padStart(6)} ${String(stats.reduce((a,s)=>a+s.retours,0)).padStart(6)} ${String(stats.reduce((a,s)=>a+s.net,0)).padStart(6)} ${fmt(totalPrime).padStart(14)}\n${sep}\n`;

        const blob = new Blob(['\uFEFF' + txt], { type: 'text/plain;charset=utf-8' });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = `Winner_Express_Livreurs_${year}-${String(month).padStart(2,'0')}.txt`;
        a.click();
    }

    generateTestData() {
        const today = new Date();
        const testData = {
            dates: [],
            recettes: [],
            livraisons: [],
            depenses: [],
            balances: []
        };

        // Générer 7 jours de données de test
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            testData.dates.push(dateStr);

            // Générer des données réalistes
            const recette = Math.floor(Math.random() * 20000) + 5000;
            const livraison = Math.floor(Math.random() * 15) + 5;
            const depense = Math.floor(Math.random() * 5000) + 1000;
            const balance = recette - depense;

            testData.recettes.push(recette);
            testData.livraisons.push(livraison);
            testData.depenses.push(depense);
            testData.balances.push(balance);
        }

        return testData;
    }
}
