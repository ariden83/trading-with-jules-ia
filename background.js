// background.js

const ALARM_NAME = "fetchEventsAlarm";
const TARGET_URL = "https://ecal.investing.com/ev_calendar_events/service";

// Fonction pour calculer le prochain 8h00
function getNext8AM() {
  const now = new Date();
  let nextAlarmTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  if (now.getHours() >= 8) {
    nextAlarmTime.setDate(nextAlarmTime.getDate() + 1);
  }
  console.log(`[Alarm] Prochaine alarme programmée pour: ${nextAlarmTime.toString()}`);
  return nextAlarmTime.getTime();
}

// Créer l'alarme
function createAlarm() {
  chrome.alarms.get(ALARM_NAME, (existingAlarm) => {
    if (existingAlarm) {
      console.log(`[Alarm] L'alarme '${ALARM_NAME}' existe déjà.`);
      // On pourrait la supprimer et la recréer pour s'assurer que l'heure est correcte,
      // ou simplement la laisser si periodInMinutes est déjà bien configuré.
      // Pour s'assurer que le premier déclenchement est bien à 8h, on la recrée.
      chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
        if(wasCleared) console.log(`[Alarm] Alarme '${ALARM_NAME}' existante supprimée pour la recréer.`);
        setDailyAlarm();
      });
    } else {
      setDailyAlarm();
    }
  });
}

function setDailyAlarm() {
 chrome.alarms.create(ALARM_NAME, {
    when: getNext8AM(),
    periodInMinutes: 24 * 60 // Tous les jours
  });
  console.log(`[Alarm] Alarme '${ALARM_NAME}' créée/mise à jour pour se déclencher quotidiennement à 8h00.`);
}


// Listener pour l'installation de l'extension ou sa mise à jour
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installée ou mise à jour.", details);
  createAlarm();
});

// Listener pour le démarrage de Chrome (si l'extension est activée)
chrome.runtime.onStartup.addListener(() => {
  console.log("Chrome a démarré.");
  // Vérifier et créer l'alarme si elle n'existe pas ou si l'heure a besoin d'être ajustée
  createAlarm();
});

// Listener pour les alarmes
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log("[Alarm] Alarme reçue:", alarm);
  if (alarm.name === ALARM_NAME) {
    console.log("[Alarm] Déclenchement de la récupération des événements...");
    fetchAndProcessEvents();
  }
});

// Fonction principale pour récupérer et traiter les événements (déclenchée par l'alarme)
async function fetchAndProcessEvents() {
  console.log("[fetchAndProcessEvents] Démarrage de la récupération automatique...");

  // Stratégie : Ouvrir l'URL dans un nouvel onglet (non actif),
  // laisser content.js faire son travail, puis fermer l'onglet.
  // Le content script enverra les données, qui seront capturées par runtime.onMessage
  // et sauvegardées par saveDataAsJSON.

  try {
    console.log(`[fetchAndProcessEvents] Ouverture de l'URL cible: ${TARGET_URL}`);
    const tab = await chrome.tabs.create({ url: TARGET_URL, active: false });
    console.log(`[fetchAndProcessEvents] Onglet créé avec ID: ${tab.id}. Attente de la capture des données par content.js...`);

    // Il n'y a pas de moyen direct d'attendre que le content script ait fini et envoyé les données.
    // On va supposer qu'il aura le temps de le faire.
    // On pourrait ajouter un timeout pour fermer l'onglet après un certain temps.
    // Pour l'instant, on le ferme après un délai fixe (ex: 30 secondes).
    // Idéalement, le content script pourrait envoyer un message "DONE"
    // ou background.js pourrait attendre un message "EVENTS_DATA" spécifique à cet onglet.

    setTimeout(() => {
      if (tab.id) {
        chrome.tabs.remove(tab.id, () => {
          if (chrome.runtime.lastError) {
            console.error(`[fetchAndProcessEvents] Erreur lors de la fermeture de l'onglet ${tab.id}:`, chrome.runtime.lastError.message);
          } else {
            console.log(`[fetchAndProcessEvents] Onglet ${tab.id} fermé.`);
          }
        });
      }
    }, 30000); // Fermer l'onglet après 30 secondes

  } catch (error) {
    console.error("[fetchAndProcessEvents] Erreur lors de la création de l'onglet:", error);
  }
  // Note: la sauvegarde des données se fait via le listener onMessage lorsque le content script envoie les données.
  // Cette fonction initie juste le processus.
}

// Fonction pour sauvegarder les données en JSON
function saveDataAsJSON(data) {
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

  chrome.downloads.download({
    url: url,
    filename: `investing_events_${timestamp}.json`,
    saveAs: false // true pour demander à l'utilisateur où sauvegarder
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error("Erreur de téléchargement:", chrome.runtime.lastError.message);
    } else {
      console.log("Téléchargement démarré avec l'ID:", downloadId);
    }
    URL.revokeObjectURL(url); // Nettoyer l'URL de l'objet blob
  });
}

// Listener pour les messages du content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Background] Message reçu:", message);
  if (message.type === "EVENTS_DATA") {
    console.log("[Background] Données d'événements reçues du content script:", message.payload);
    // Ici, nous pourrions faire un traitement plus spécifique si nécessaire
    // Pour l'instant, on sauvegarde directement les données reçues.
    // Il faudra peut-être s'assurer que ce sont bien les données finales et complètes.
    saveDataAsJSON(message.payload);
    // Indiquer que nous allons répondre de manière asynchrone (si nécessaire)
    // return true;
  }
});

// Injecter le content script lorsque la page cible est chargée
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("https://ecal.investing.com/ev_calendar_events/service")) {
    console.log(`[Background] Injection de content.js dans l'onglet ${tabId} (URL: ${tab.url})`);
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    }).then(() => {
      console.log("[Background] content.js injecté avec succès.");
    }).catch(err => {
      console.error("[Background] Erreur lors de l'injection de content.js:", err);
    });
  }
});


// L'ancien webRequest listener est moins crucial maintenant que nous avons le content script,
// mais il peut toujours être utile pour le logging ou pour comprendre le flux des requêtes.
// Pour l'instant, je vais le commenter pour éviter la redondance de logs si le content script fonctionne bien.
/*
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.url.startsWith("https://ecal.investing.com/ev_calendar_events/service")) {
      console.log(`[webRequest.onCompleted] Requête pertinente détectée: ${details.method} ${details.url} (ID: ${details.requestId}, Type: ${details.type}, TabId: ${details.tabId})`);
      if (details.tabId > 0 && (details.type === "xmlhttprequest" || details.type === "fetch")) {
        console.log(`[webRequest.onCompleted] La requête ${details.url} semble être un appel API.`);
      }
    }
  },
  { urls: ["https://ecal.investing.com/ev_calendar_events/service*"] },
  []
);
*/

console.log("background.js chargé. Prêt à injecter content.js et à recevoir des messages.");
