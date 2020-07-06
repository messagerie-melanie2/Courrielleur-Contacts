/* module pour la mise à jour silentieuse des adresses collectées */

ChromeUtils.import("resource://gre/modules/Services.jsm");


Services.scriptloader.loadSubScript("chrome://contacts/content/contacts-majadrcol.js", null, "UTF-8");


const EXPORTED_SYMBOLS = ["cm2MajAdrColSilent"];

// ChromeUtils.import("resource://gre/modules/cm2MajAdrCol.jsm");cm2MajAdrColSilent();

// callback : fonction de rappel en fin d'opération (sans parametre) (optionnelle)
function cm2MajAdrColSilent(callback){
  
  gMajAdrColDlg.ExecuteSilent(callback);
}
