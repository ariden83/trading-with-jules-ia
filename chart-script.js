document.addEventListener('DOMContentLoaded', () => {
    const jsonFileInput = document.getElementById('jsonFileInput');
    const canvas = document.getElementById('eventsChart');
    const ctx = canvas.getContext('2d');
    let eventsChart = null;

    jsonFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            console.log("Aucun fichier sélectionné.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                console.log("Données JSON chargées :", jsonData);
                // La structure exacte des données dépend de l'API d'investing.com
                // Nous supposons que les données sont dans une propriété, par exemple `data.events` ou similaire.
                // Si le JSON est directement un tableau, on peut utiliser jsonData.
                // Pour cet exemple, je vais chercher un tableau dans le JSON.
                const events = findEventsArray(jsonData);
                if (!events) {
                    alert("Impossible de trouver un tableau d'événements dans le fichier JSON. Veuillez vérifier la structure du fichier et ajuster le script.");
                    return;
                }
                processAndRenderChart(events);
            } catch (error) {
                console.error("Erreur lors du parsing du fichier JSON :", error);
                alert("Le fichier sélectionné n'est pas un JSON valide.");
            }
        };
        reader.readAsText(file);
    });

    function findEventsArray(jsonData) {
        // Cette fonction tente de deviner où se trouve le tableau d'événements.
        // C'est la partie la plus susceptible de nécessiter une adaptation.
        if (Array.isArray(jsonData)) {
            return jsonData;
        }
        if (jsonData.events && Array.isArray(jsonData.events)) {
            return jsonData.events;
        }
        if (jsonData.data && Array.isArray(jsonData.data)) {
            return jsonData.data;
        }
        // Chercher la première propriété qui est un tableau
        for (const key in jsonData) {
            if (Array.isArray(jsonData[key])) {
                return jsonData[key];
            }
        }
        return null;
    }

    function processAndRenderChart(events) {
        // Détruire l'ancien graphique s'il existe
        if (eventsChart) {
            eventsChart.destroy();
        }

        // ====================================================================================
        // !! POINT IMPORTANT À ADAPTER !!
        // Les noms des propriétés 'event_timestamp' et 'title' sont des suppositions.
        // Vous devrez les remplacer par les vrais noms de clés trouvés dans le fichier JSON.
        // Par exemple: 'date', 'name', 'event_name', etc.
        // Le timestamp doit être un timestamp UNIX (en secondes ou millisecondes) ou une chaîne de date ISO 8601.
        const chartData = events.map(event => ({
            x: new Date(event.event_timestamp * 1000), // Multiplier par 1000 si le timestamp est en secondes
            y: 0, // Nous plaçons tous les points sur la même ligne y
            title: event.title,
            country: event.country
        })).sort((a, b) => a.x - b.x); // Trier par date croissante

        console.log("Données préparées pour le graphique :", chartData);

        eventsChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Événements Économiques',
                    data: chartData,
                    backgroundColor: 'rgba(26, 35, 126, 0.7)',
                    borderColor: 'rgba(26, 35, 126, 1)',
                    pointRadius: 6,
                    pointHoverRadius: 9
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        time: {
                            unit: 'day',
                            tooltipFormat: 'dd MMM yyyy HH:mm',
                            displayFormats: {
                                day: 'dd MMM yyyy'
                            }
                        }
                    },
                    y: {
                        display: false, // On cache l'axe Y car il n'a pas de signification
                        min: -1,
                        max: 1
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const dataPoint = context.raw;
                                return `${dataPoint.title} (${dataPoint.country})`;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
});
