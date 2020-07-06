ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");


window.addEventListener("load",
       function onload(event) {
        window.removeEventListener("load", onload, false);
        document.getElementById("dirTreeContext").addEventListener("popupshowing", affichePopupContacts, false);
        document.getElementById("menu_View_Popup").addEventListener("popupshowing", afficheMenuContacts, false);
        
        MailServices.ab.addAddressBookListener(gCm2ABListener,
                                               Components.interfaces.nsIAbListener.directoryRemoved);
                                 
        // mantis 4780
        let dirTree=document.getElementById('dirTree');
        dirTree.controllers.appendController(gDirPaneCtrl);
        // mettre a jour etat button_delete
        window.setTimeout(cm2InitBtDelete, 500);
                                 
       }, false);

function cm2InitBtDelete(){
  
  let etat=gDirPaneCtrl.isCommandEnabled("button_delete");
  let bt=document.getElementById("button_delete");
  if (bt) {
    if (etat)
      bt.removeAttribute("disabled");
    else
      bt.setAttribute("disabled", "true");
  }
}


// nsIAbListener 
let gCm2ABListener = {
  
  onItemAdded: function(parentDir, item) {},
  
  onItemRemoved: function(parentDir, item) {
    
    let directory=item.QueryInterface(Components.interfaces.nsIAbDirectory);
    
    let dirPrefId=directory.dirPrefId;
    if (Services.prefs.prefHasUserValue(CM2DAV_PREF_SOGO+dirPrefId+".url")){
      
      let prefid=dirPrefId.substr("ldap_2.servers.".length);
      
      Services.prefs.setBoolPref(CM2DAV_PREFIXE_CARNETS+prefid+".affichage", false);
      
      Services.prefs.deleteBranch(CM2DAV_PREF_SOGO+dirPrefId);
      
      // supprimer les preferences sogo des listes
      let prefs=Services.prefs.getBranch(CM2DAV_PREF_SOGO);
      let prefNames=prefs.getChildList("", {});
      for (let m of prefNames) {
        if (0==m.indexOf(prefid+"_MailList"))
          Services.prefs.clearUserPref(CM2DAV_PREF_SOGO+m);
      }

      Services.prefs.savePrefFile(null);
    }
    
  },
  onItemPropertyChanged: function(item, property, oldValue, newValue){}
}

function OuvreAnaisDepuisCarnet()
{
  //gestion du mode offline
  if (Services.io.offline)
  {
    AnaisAfficheMsgId("anaisdlg_ErrDeconnecte");
    return ;
  }
  
  //rechercher fenêtre Anais dejà ouverte
  let windowManager=Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
  
  //anaisModeChoixDest
  let fenanais=null;
  let liste=windowManager.getEnumerator("anaismoz-dlg");
  while (liste.hasMoreElements())
  {
    let fen=liste.getNext();
    if (0==fen.anaisModeChoixDest())
    {
      fenanais=fen;
      break;
    }
  }
  if (fenanais)
  {
    fenanais.document.commandDispatcher.focusedWindow.focus();
    return;
  }
  
  // #5515 si chromehidden est renseigné, c'est une popup
  if(window.document.documentElement.getAttribute("chromehidden"))
  {
    // On ouvre sous forme de fenêtre
    window.openDialog("chrome://anais/content/anaismozdlg.xul", "", "chrome,center,resizable,titlebar,dialog=no");
  }
  else
  {
    // Sinon on ouvre sous forme d'onglet
    OuvreEnOnglet("chrome://anais/content/anaismozdlg.xul", "cm2-tab-anais");
  }
}

function affichePopupContacts(){

  let res=isOptionAfficheEnable();
  let elem=document.getElementById("cm2masque-popup");
  elem.disabled=!res;

  // commande mettre a jour les adresses collectées
  elem=document.getElementById("cm2maj-popup");
  elem.hidden=true;
  let seldir=GetSelectedDirectory();
  if (seldir && ""!=seldir){
    let dir=MailServices.ab.getDirectory(seldir);
    if (dir &&
        "ldap_2.servers.history"==dir.dirPrefId){
      elem.hidden=false;
      if (Services.io.offline)
        elem.disabled=true;
      else
        elem.disabled=false;
    }
  }
}

function afficheMenuContacts(){

  let res=isOptionAfficheEnable();
  let elem=document.getElementById("cm2masque-menu");
  elem.disabled=!res;
}

function isOptionAfficheEnable(){

  let res=false;
  let connecte=cm2davTestConnexion();
  if (false==connecte)
    return res;

  let seldir=GetSelectedDirectory();

  if (seldir && ""!=seldir){

    res=isGroupdavDirectory(seldir);

    if (res){

      let abDir=GetDirectoryFromURI(seldir);

      try {

        let defaut=Services.prefs.getCharPref("courrielleur.contactsdav.defaut");

        if("ldap_2.servers."+defaut==abDir.dirPrefId){
          let prefName=abDir.dirPrefId+".disable_delete";
          Services.prefs.setBoolPref(prefName, true);
          goUpdateCommand("cmd_delete");
          return false;
        }
      }
      catch(ex) {
        // if this preference is not set its ok.
      }
    }
  }

  return res;
}

function AffichageCarnets(){

  let carnetsCm2=cm2davListeCarnetsCm2();
  let args=new Object();
  args["carnets"]=carnetsCm2;

  window.openDialog("chrome://contacts/content/contactsdav-aff.xul", "", "chrome,modal,centerscreen,titlebar,resizable", args);

  if (null==args.maj || !args.maj)
    return;

  //mise a jour affichage
  for (let carnet of carnetsCm2) {

    let aff=carnet["affichage"];

    if (aff){
      //afficher à nouveau
      Services.prefs.setBoolPref(CM2DAV_PREFIXE_CARNETS+carnet["prefid"]+".affichage", true);
    } else{
      //ne pas afficher
      Services.prefs.setBoolPref(CM2DAV_PREFIXE_CARNETS+carnet["prefid"]+".affichage", false);
    }
  }

  //mise a jour configuration
  let mailWindow=Services.wm.getMostRecentWindow("mail:3pane");

  if (mailWindow && mailWindow.cm2davConfigureCarnets){
    mailWindow.cm2davStopTimerRefresh();
    mailWindow.cm2davStartTimerRefresh(100);
  }
}

function AffichageMasquer(){

  let seldir=GetSelectedDirectory();
  if (seldir && ""!=seldir &&
      isGroupdavDirectory(seldir)){

    //masquer le carnet selectionne
    let dir=MailServices.ab.getDirectory(seldir);
    const prefix="ldap_2.servers.";
    let dirId=dir.dirPrefId.substr(prefix.length);
    cm2davSupprimeCarnet(dirId);
  }
}


// mise a jour des adresses collectées
function cm2MajAdrCol(){

  if (Services.io.offline)
    alert("Le courrielleur est hors connexion. La mise à jour n'est pas réalisable.");
  else
    window.openDialog("chrome://contacts/content/contacts-majadrcol.xul", "", "chrome,modal,centerscreen,titlebar,resizable");
}


function cm2PartageContacts(){

  let mailWindow=Services.wm.getMostRecentWindow("mail:3pane");

  if (mailWindow &&
      mailWindow.webtabs)
    mailWindow.webtabs.openWebAppTab('roundcube', 'shareAddressbook');
}

// mantis 4780
// version etendue de chrome\messenger\content\messenger\addressbook\abCommon.js
let gDirPaneCtrl={
  
  supportsCommand: function(command){
    
    switch (command) {

      case "cmd_delete":
      case "button_delete":
        return true;
      default:
        return false;
    }
  },

  isCommandEnabled: function(command){
    
    let selectedDir = GetSelectedDirectory();
    
    if (command == "cmd_delete" && selectedDir)
      goSetMenuValue(command, GetDirectoryFromURI(selectedDir).isMailList ?
                              "valueList" : "valueAddressBook");

    if (selectedDir &&
        (selectedDir != kPersonalAddressbookURI) &&
        (selectedDir != kCollectedAddressbookURI) &&
        (selectedDir != (kAllDirectoryRoot + "?"))) {
          
      // If the directory is a mailing list, and it is read-only, return
      // false.
      let abDir = GetDirectoryFromURI(selectedDir);
      if (abDir.isMailList && abDir.readOnly)
        return false;

      // If the selected directory is an ldap directory
      // and if the prefs for this directory are locked
      // disable the delete button.
      if (selectedDir.startsWith(kLdapUrlPrefix))
      {
        let disable = false;
        try {
          let prefName = selectedDir.substr(kLdapUrlPrefix.length);
          disable = Services.prefs.getBoolPref(prefName + ".disable_delete");
        }
        catch(ex) {
          // if this preference is not set its ok.
        }
        if (disable)
          return false;
      }
      
      //
      const carnetprefix="moz-abmdbdirectory://";
      if (selectedDir.startsWith(carnetprefix))
      {
        let disable = false;
        try {
          let prefName=abDir.dirPrefId+".disable_delete";
          disable=Services.prefs.getBoolPref(prefName);
        }
        catch(ex) {
          // if this preference is not set its ok.
        }
        if (disable)
          return false;
      }
      
      return true;
    }
    else
      return false;
  },
  
  doCommand: function(command){
    // code tb
    DirPaneController.doCommand(command);
  },

  onEvent: function(event) {
    // code tb
    DirPaneController.onEvent(event);
  }
}
