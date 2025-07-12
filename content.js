// content.js
console.log("[ContentScript] Injecté et en cours d'exécution.");

const TARGET_URL_PREFIX = "https://ecal.investing.com/ev_calendar_events/service";

// Sauvegarde des fonctions originales
const originalFetch = window.fetch;
const originalXhrOpen = window.XMLHttpRequest.prototype.open;
const originalXhrSend = window.XMLHttpRequest.prototype.send;

// Monkey-patch window.fetch
window.fetch = async function(...args) {
  const url = args[0] instanceof Request ? args[0].url : args[0];
  const method = args[0] instanceof Request ? args[0].method : (args[1] ? args[1].method : 'GET');

  // Exécute la requête originale
  const response = await originalFetch.apply(this, args);

  if (typeof url === 'string' && url.startsWith(TARGET_URL_PREFIX)) {
    console.log(`[ContentScript Fetch] Intercepté: ${method} ${url}`);
    // Clone la réponse pour pouvoir lire le corps ici et le retourner à l'appelant original
    const clonedResponse = response.clone();
    clonedResponse.json().then(data => {
      console.log("[ContentScript Fetch] Données JSON de la réponse:", data);
      // Envoyer les données au background script
      chrome.runtime.sendMessage({ type: "EVENTS_DATA", payload: data, source: "fetch" });
    }).catch(err => {
      // Peut-être que la réponse n'est pas du JSON, ou une autre erreur
      clonedResponse.text().then(textData => {
        console.log("[ContentScript Fetch] Données TEXT de la réponse (non-JSON):", textData.substring(0, 500));
      }).catch(textErr => {
        console.error("[ContentScript Fetch] Erreur en lisant la réponse comme texte:", textErr);
      });
    });
  }
  return response;
};

// Monkey-patch XMLHttpRequest
let xhrRequests = new Map(); // Pour stocker les détails de la méthode et de l'URL

window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  if (typeof url === 'string' && url.startsWith(TARGET_URL_PREFIX)) {
    console.log(`[ContentScript XHR] Intercepté OPEN: ${method} ${url}`);
    // Stocker les détails de cette instance de XHR
    xhrRequests.set(this, { method, url });
  }
  return originalXhrOpen.apply(this, [method, url, ...rest]);
};

window.XMLHttpRequest.prototype.send = function(...args) {
  const xhrDetails = xhrRequests.get(this);

  if (xhrDetails) {
    this.addEventListener('load', function() {
      if (this.readyState === 4 && this.status >= 200 && this.status < 300) {
        console.log(`[ContentScript XHR] Intercepté LOAD: ${xhrDetails.method} ${xhrDetails.url} - Status: ${this.status}`);
        try {
          // Assumons que la réponse est du JSON
          const responseData = JSON.parse(this.responseText);
          console.log("[ContentScript XHR] Données JSON de la réponse:", responseData);
          // Envoyer les données au background script
          chrome.runtime.sendMessage({ type: "EVENTS_DATA", payload: responseData, source: "xhr" });
        } catch (e) {
          console.warn("[ContentScript XHR] Réponse non-JSON ou erreur de parsing:", this.responseText.substring(0, 500));
        }
      }
    });
     this.addEventListener('error', function() {
        console.error(`[ContentScript XHR] Erreur pour ${xhrDetails.method} ${xhrDetails.url}`);
        xhrRequests.delete(this);
    });
    this.addEventListener('abort', function() {
        console.warn(`[ContentScript XHR] Avorté pour ${xhrDetails.method} ${xhrDetails.url}`);
        xhrRequests.delete(this);
    });
  }
  const result = originalXhrSend.apply(this, args);
  if (xhrDetails) {
      // On pourrait vouloir supprimer de la map après un certain temps ou sur 'loadend'
      // pour éviter les fuites de mémoire si beaucoup de requêtes sont faites.
      // Pour l'instant, on le laisse pour la simplicité du débuggage.
  }
  return result;
};

console.log("[ContentScript] Monkey-patching de fetch et XMLHttpRequest terminé.");

// Pour que ce content script soit injecté, il faut mettre à jour le manifest.json
// ou l'injecter dynamiquement depuis background.js en utilisant chrome.scripting.executeScript.
// L'injection dynamique est plus flexible.
// Je vais modifier background.js pour injecter ce script.
// Et aussi ajouter un listener dans background.js pour les messages du content script.
