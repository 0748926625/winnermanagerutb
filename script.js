// Configuration Firebase — UTB
const firebaseConfig = {
    apiKey:            "AIzaSyDEOVQ7Zctxm-e-uckUNopUUHKL8iQ51bk",
    authDomain:        "winnergestionutb.firebaseapp.com",
    projectId:         "winnergestionutb",
    storageBucket:     "winnergestionutb.firebasestorage.app",
    messagingSenderId: "487787959913",
    appId:             "1:487787959913:web:69e58c00ee51152f0cb4f8",
    measurementId:     "G-BP2WPS1DW8"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

class DeliveryDashboard {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('deliveryHistoricalData')) || {};
        this.currentDate = new Date().toISOString().split('T')[0];
        
        this.initSelectors();
        this.initEventListeners();
        
        // Initialiser Firebase et se connecter automatiquement
        this.initFirebase();
        
        // Ne charger les données du formulaire que si on est sur la page principale
        if (document.getElementById('liv-1000')) {
            this.loadDateData(this.currentDate);
        }
        
        // Charger les données pour les graphiques après un court délai
        setTimeout(() => {
            this.loadChartData();
            this.updateChartPeriod('month'); // Par défaut : mois en cours
        }, 500);
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
                m1000: mar1000 ? mar1000.value : 75,
                m1500: mar1500 ? mar1500.value : 75,
                m2000: mar2000 ? mar2000.value : 75,
                m2500: mar2500 ? mar2500.value : 75
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
        localStorage.setItem('deliveryHistoricalData', JSON.stringify(this.data));
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
            if (mar1000) mar1000.value = d.liv.m1000 || 75;
            if (mar1500) mar1500.value = d.liv.m1500 || 75;
            if (mar2000) mar2000.value = d.liv.m2000 || 75;
            if (mar2500) mar2500.value = d.liv.m2500 || 75;
            
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
                i.value = 75;
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
        notification.innerHTML = `
            <div class="flex-shrink-0">
                <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center animate-pulse">
                    <i class="fas fa-check text-green-500 text-sm"></i>
                </div>
            </div>
            <div>
                <p class="font-semibold">Données enregistrées</p>
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
            const margPct = (parseFloat(res.liv[`m${val}`]) || 75) / 100;
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
        
        rapport += `\nMarge 1000 FCFA: ${details.find(d => d.val === 1000)?.margPct || 75}%
Marge 1500 FCFA: ${details.find(d => d.val === 1500)?.margPct || 75}%
Marge 2000 FCFA: ${details.find(d => d.val === 2000)?.margPct || 75}%
Marge 2500 FCFA: ${details.find(d => d.val === 2500)?.margPct || 75}%
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
                    const margPct = (parseFloat(liv[`m${val}`]) || 75) / 100;
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
                const firebaseData = doc.data().deliveryData || {};
                console.log('📥 Données trouvées dans Firebase:', firebaseData);
                console.log('📊 Nombre de jours dans Firebase:', Object.keys(firebaseData).length);
                
                // Fusionner avec les données locales
                const localData = JSON.parse(localStorage.getItem('deliveryHistoricalData')) || {};
                console.log('💾 Données locales actuelles:', localData);
                console.log('📊 Nombre de jours en local:', Object.keys(localData).length);
                
                const mergedData = { ...localData, ...firebaseData };
                console.log('🔀 Données fusionnées:', mergedData);
                
                this.data = mergedData;
                localStorage.setItem('deliveryHistoricalData', JSON.stringify(mergedData));
                
                console.log('✅ Données chargées et fusionnées avec succès !');
                
                // Recharger les données si on est sur la page principale
                if (document.getElementById('liv-1000')) {
                    this.loadDateData(this.currentDate);
                }
            } else {
                console.log('📭 Aucune donnée trouvée dans Firebase pour cet utilisateur');
            }
        } catch (error) {
            console.error('❌ Erreur de synchronisation depuis Firebase:', error);
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

            // 4. Si on a le user, on envoie les données
            const currentData = JSON.parse(localStorage.getItem('deliveryHistoricalData')) || {};
            console.log('📊 Données locales à synchroniser:', currentData);
            
            await db.collection('users').doc(user.uid).set({
                deliveryData: currentData,
                lastSync: new Date().toISOString(),
                email: user.email
            }, { merge: true });
            
            console.log('✅ Données synchronisées avec succès pour:', user.email);
            this.showSyncStatus();
            
        } catch (error) {
            console.error('❌ Erreur Firestore:', error);
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
        
        // Préparer les données pour les graphiques
        const dates = Object.keys(this.data).sort();
        const recettes = [];
        const livraisons = [];
        const depenses = [];
        const balances = [];

        dates.forEach(date => {
            const dayData = this.data[date];
            if (dayData) {
                // Calculer les recettes et dépenses pour cette date
                let net = 0;
                let totalDep = 0;
                let totalLiv = 0;

                // Calcul des livraisons
                [1000, 1500, 2000, 2500].forEach(val => {
                    const qty = Math.max(0, parseInt(dayData.liv[`l${val}`]) || 0);
                    const ech = Math.min(qty, Math.max(0, parseInt(dayData.liv[`e${val}`]) || 0));
                    const reussies = qty - ech;
                    const margPct = (parseFloat(dayData.liv[`m${val}`]) || 75) / 100;
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
