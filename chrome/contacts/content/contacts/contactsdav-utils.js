
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/FileUtils.jsm");


/**
* Génération de logs dans la console
*/
var gContactsTrace=false;
var gContactsConsole=null;

function cm2DavTrace(msg){
  
  if (!gContactsTrace){
    let t=Services.prefs.getBoolPref("courrielleur.contactsdav.traces");
    if (t)
      gContactsConsole=Services.console;
    gContactsTrace=true;
  }  

  if (gContactsConsole)
    gContactsConsole.logStringMessage("contactsdav - "+msg);
}



/**
* Enregistrements des evenement dans un fichier et dans la console (doublage)
*/

//nom du fichier log
const CM2DAV_FICHIER_LOG="contactsdav.log";

const CM2DAV_FICHIER_LOG_SEP="\t";

var gCm2DavFichierLogs=null;

//sources d'evenement
const CM2DAV_LOGS_MODULE="CM2DAV";
const CM2DAV_LOGS_GEN="General";
const CM2DAV_LOGS_CFG="Configuration";
const CM2DAV_LOGS_REQ="Requete serveur";
const CM2DAV_LOGS_SYNC="Synchronisation";

//taille maxi du fichier de logs avant rotation
const CM2DAV_LOGS_MAX=1000000;
const CM2DAV_FICHIER_LOG1="contactsdav-1.log";

/* rotation fichier logs
 supprime *-1.log existant
 renomme en *-1.log
 cree *.log
*/
function cm2DavLogsRotate(){

  cm2DavTrace("cm2DavLogsRotate");

  try{

    let fichier=Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
    fichier.append(CM2DAV_FICHIER_LOG);
    cm2DavTrace("cm2DavLogsRotate fichier."+fichier.path);
    fichier.moveTo(null, CM2DAV_FICHIER_LOG1);

  } catch(ex){
    cm2DavTrace("cm2DavLogsRotate exception:"+ex);
  }
}


//initialisation
function cm2DavInitLogs(){

  cm2DavTrace("cm2DavInitLogs");

  try{

    let fichier=Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
    fichier.append(CM2DAV_FICHIER_LOG);

    if (fichier.exists()){
      cm2DavTrace("cm2DavInitLogs fichier existant");
      //test taille fichier
      if (fichier.fileSize>CM2DAV_LOGS_MAX){
        cm2DavLogsRotate();
      }
    } else {
      cm2DavTrace("cm2DavInitLogs creation du fichier:"+CM2DAV_FICHIER_LOG);
      fichier.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    }

    gCm2DavFichierLogs=Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
    gCm2DavFichierLogs.init(fichier, FileUtils.MODE_WRONLY|FileUtils.MODE_CREATE|FileUtils.MODE_APPEND, FileUtils.PERMS_FILE, 0);


  } catch(ex){
    cm2DavTrace("cm2DavInitLogs exception."+ex);
  }
}


//écriture evenement (fichier + console)
function cm2DavEcritLog(source, description, donnees){
  
  if (null==gCm2DavFichierLogs)
    cm2DavInitLogs();
  if (null==gCm2DavFichierLogs){
    return;
  }

  if (null!=donnees)
    cm2DavTrace(source+" - "+description+" - "+donnees);
  else
    cm2DavTrace(source+" - "+description);

  if (null==gCm2DavFichierLogs){
    cm2DavTrace("cm2DavEcritLog fichier non initialise");
    return;
  }

  //date heure
  let dh=new Date();
  let strdh="["+dh.getDate()+"/"+(dh.getMonth()+1)+"/"+dh.getFullYear()+" "+dh.getHours()+":"+dh.getMinutes()+":"+dh.getSeconds()+"]";
  let src="";
  if (null!=source)
    src=source;
  let desc="";
  if (null!=description)
    desc=description;
  let don="";
  if (null!=donnees)
    don=donnees;

  let msg=strdh+CM2DAV_FICHIER_LOG_SEP+"["+src+"]"+CM2DAV_FICHIER_LOG_SEP+
          "\""+desc+"\""+CM2DAV_FICHIER_LOG_SEP+"\""+don+"\"\x0D\x0A";

  gCm2DavFichierLogs.write(msg, msg.length);
  gCm2DavFichierLogs.flush();
}

/**
* Verifie le mode connecte
* return true si connecte, false (offline)
*/
function cm2davTestConnexion() {
  
  return !Services.io.offline;
}
