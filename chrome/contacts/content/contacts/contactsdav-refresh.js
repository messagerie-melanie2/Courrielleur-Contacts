ChromeUtils.import("resource://gre/modules/Services.jsm");


//preference intervalle de rafraichissement en minutes
const CM2DAV_PREF_REFRESH_INTERVAL="courrielleur.contactsdav.refreshInterval";
//intervalle de rafraichissement par defaut en minutes
const CM2DAV_REFRESH_INTERVAL=60;


/**
* Retourne l'intervalle de rafraichissement en minutes
*/
function cm2davGetRefreshInterval() {

  return Services.prefs.getIntPref(CM2DAV_PREF_REFRESH_INTERVAL, CM2DAV_REFRESH_INTERVAL);
}


/**
* Fonction de rappel du timer de rafraichissement
*/
let gCm2davTimerRefreshCallback = {

  notify : function refreshNotify(aTimer) {
    
    cm2DavEcritLog(CM2DAV_LOGS_SYNC, "Processus de synchronisation");
    aTimer.cancel();
    
    let connecte=cm2davTestConnexion();
    if (false==connecte) {
      cm2DavTrace("cm2davTimerRefresh client offline - pas de rafraichissement");
      cm2DavEcritLog(CM2DAV_LOGS_SYNC, "Mode hors ligne");
      cm2davStartTimerRefresh();
      return;
    }
    cm2DavTrace("cm2davTimerRefresh rafraichissement");

    //configuration automatique
    function RetourConfigure() {
      cm2DavTrace("cm2davTimerRefresh synchronisation des carnets");
      cm2DavEcritLog(CM2DAV_LOGS_SYNC, "Synchronisation des carnets");
      startFolderSync();
      cm2davStartTimerRefresh();
    }
    
    cm2DavTrace("cm2davTimerRefresh configuration automatique");
    cm2DavEcritLog(CM2DAV_LOGS_SYNC, "Configuration des carnets");
    cm2davConfigureCarnets(RetourConfigure);
  }
}


//instance globale du timer de rafraichissement
let gCm2davTimerRefresh=null;

/**
* Demarrage du timer de rafraichissement
* delai : delai en milli-secondes
*/
function cm2davStartTimerRefresh(delai) {

  if (null==gCm2davTimerRefresh) {
    gCm2davTimerRefresh=Components.classes["@mozilla.org/timer;1"]
                                .createInstance(Components.interfaces.nsITimer);
  } else {
    cm2DavTrace("cm2davStartTimerRefresh arret du timer en cours");
    gCm2davTimerRefresh.cancel();
  }

  let duree=delai;

  if (null==duree) {

    let refreshInterval=cm2davGetRefreshInterval();

    cm2DavEcritLog(CM2DAV_LOGS_SYNC, "Demarrage du timer de synchronisation - intervalle (min):", refreshInterval);
    duree=refreshInterval*60000;

  } else {
    cm2DavTrace("cm2davStartTimerRefresh demarrage du timer intervalle (s):"+duree);
  }

  gCm2davTimerRefresh.initWithCallback(gCm2davTimerRefreshCallback,
                                      duree,
                                      Components.interfaces.nsITimer.TYPE_ONE_SHOT);
}


/**
* Arret du timer de rafraichissement
*/
function cm2davStopTimerRefresh() {

  cm2DavTrace("cm2davStopTimerRefresh");
  cm2DavEcritLog(CM2DAV_LOGS_SYNC, "Arret du timer de synchronisation");

  if (null==gCm2davTimerRefresh)
    return;
  
  gCm2davTimerRefresh.cancel();
  gCm2davTimerRefresh=null;
}
