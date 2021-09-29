ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource://gre/modules/pacomeAuthUtils.jsm");



/**
* constantes de configuration
*/
//prefixe marquage des carnets contactsdav
const CM2DAV_PREFIXE_CARNETS="courrielleur.contactsdav.carnet.";

//preference nom du serveur Cm2Dav
const CM2DAV_PREF_SERVER_NAME="courrielleur.contactsdav.serveur.nom";
//preference racine des carnets sur le serveur
const CM2DAV_PREF_SERVER_RACINE="courrielleur.contactsdav.serveur.racine";

//protocole serveur
const CM2DAV_PROTO="https://";
//const CM2DAV_PROTO="http://";//dev

//prefixe des preferences des carnets thunderbird
const CM2DAV_PREF_LDAP2="ldap_2.servers.";
//prefixe des preferences des carnets Sogo
const CM2DAV_PREF_SOGO="extensions.ca.inverse.addressbook.groupdav.";


/**
* Inclusion de fichiers Sogo
*/
function cm2davIncludeSogo(fichiers) {

  Services.scriptloader.loadSubScript("chrome://sogo-connector/content/addressbook/folder-handling.js");
  Services.scriptloader.loadSubScript("chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js");
}
cm2davIncludeSogo();



/**
* Fonction de configuration automatique des carnets d'adresses
* Met a jour les carnets d'adresses du courrielleur
*
* fncfin : fonction de retour en fin d'opérations
*
* v0.1 : version limitee a l'identifiant principal pacome
* mantis 0003333 : Permettre de choisir les carnets d'adresses horde affichés
*     ne pas ajouter les carnets qui ne sont pas affiches (choix utilisateur)
*
*/
function cm2davConfigureCarnets(fncfin) {

  cm2DavTrace("cm2davConfigureCarnets");

  //obtenir identifiant principal
  let uid=cm2davUidPrincipal();
  cm2DavTrace("cm2davConfigureCarnets identifiant principal:"+uid);

  if (null==uid || ""==uid) {
    cm2DavTrace("cm2davConfigureCarnets pas d'identifiant principal");
    cm2DavEcritLog(CM2DAV_LOGS_CFG, "Pas d'identifiant principal", "");
    return;
  }
  cm2DavEcritLog(CM2DAV_LOGS_CFG, "Identifiant principal", uid);

  //lister les carnets du courrielleur
  let carnetsCm2=cm2davListeCarnetsCm2();
  
  //migration des noms
  cm2davMigreNouvNoms(carnetsCm2);  

  //fonction de rappel pour cm2davListeCarnetsSrv
  function retourListeDav(status, carnetsDav) {

    cm2DavTrace("retourListeDav");
    if (status!=207) {
      cm2DavTrace("cm2davConfigureCarnets status!207 stop configuration automatique");
      return;
    }

    //supprimer les carnets cm2 qui ne sont plus sur le serveur
    for (let carnet of carnetsCm2) {
      
      let preserve=cm2davSearchCarnetInListe(carnet, carnetsDav);
      if (preserve) {
        continue;
      }
      //suppression
      cm2DavTrace("cm2davConfigureCarnets suppression du carnet prefid:"+carnet["prefid"]);
      cm2DavEcritLog(CM2DAV_LOGS_CFG, "Suppression d'un carnet prefid", carnet["prefid"]);
      cm2davSupprimeCarnet(carnet["prefid"]);
    }

    //ajouter ou modifier les carnets d'adresses
    for (let carnet of carnetsDav) {
      
      cm2DavTrace("cm2davConfigureCarnets - traitement du carnet url:"+carnet["url"]);
      let existe=cm2davCarnetExiste(carnet);
      let resultat=false;
      let op;
      if (existe) {
        //supprimer les carnets qui ne sont pas affiches (choix utilisateur)
        if (Services.prefs.prefHasUserValue(CM2DAV_PREFIXE_CARNETS+carnet["prefid"]+".affichage")){
          let aff=Services.prefs.getBoolPref(CM2DAV_PREFIXE_CARNETS+carnet["prefid"]+".affichage");       
          if (!aff){
            cm2DavEcritLog(CM2DAV_LOGS_CFG, "Suppression d'un carnet non affiche prefid", carnet["prefid"]);
            cm2davSupprimeCarnet(carnet["prefid"]);
            continue;
          }
        }
        
        op="Mise a jour du carnet : '";
        cm2DavEcritLog(CM2DAV_LOGS_CFG, "Mise a jour d'un carnet", carnet["url"]);
        resultat=cm2davMajCarnet(carnet);
        
      } else {
        //ne pas ajouter les carnets qui ne sont pas affiches (choix utilisateur)
        if (Services.prefs.prefHasUserValue(CM2DAV_PREFIXE_CARNETS+carnet["prefid"]+".affichage")){
          let aff=Services.prefs.getBoolPref(CM2DAV_PREFIXE_CARNETS+carnet["prefid"]+".affichage");       
          if (!aff){
            cm2DavTrace("cm2davConfigureCarnets carnet non affiche => pas d'ajout");
            continue;
          }
        }
        
        op="Ajout du carnet : '";
        cm2DavEcritLog(CM2DAV_LOGS_CFG, "Ajout d'un carnet", carnet["url"]);
        resultat=cm2davAjoutCarnet(carnet);
      }
      
      let msg=op+carnet["url"]+(resultat?"' => succes":" => echec");
      cm2DavEcritLog(CM2DAV_LOGS_CFG, msg);
      cm2DavTrace("cm2davConfigureCarnets "+msg);
    }
    
    //v3.0 - Bug mantis 0004251: Les carnets supprimés sur le serveur sont toujours listés dans la boîte d'affichage
    // mettre a jour carnet supprimes
    cm2davMajListeCarnetAff(carnetsDav);
    
    // mantis 0004780: Abandon du carnet "Adresses personnelles" pour les nouveaux profils
    let val=Services.prefs.getCharPref("courrielleur.contactsdav.defaut");  
    if (""==val){
      let prefid=cm2davDirName(uid);
      if (Services.prefs.prefHasUserValue("ldap_2.servers."+prefid+".filename")){
        cm2DavEcritLog(CM2DAV_LOGS_CFG, "Configuration du carnet par defaut identifiant:"+prefid);
        cm2DavTrace("Configuration du carnet par defaut identifiant:"+prefid);
        // carnet par defaut
        Services.prefs.setCharPref("courrielleur.contactsdav.defaut", prefid);
        // carnet non supprimable
        Services.prefs.setBoolPref("ldap_2.servers."+prefid+".disable_delete", true);
      }
    }

    if (fncfin)
      fncfin();
  }

  //lister les carnets du serveur
  cm2davListeCarnetsSrv(uid, retourListeDav);
}


/**
* Teste si carnet existe a partir d'un tableau infos
* test sur l'url
* carnet : tableau infos
* liste : liste de carnet pour la recherche
* return true si present
*/
function cm2davSearchCarnetInListe(carnet, liste) {
  for (let cdav of liste) {
    if (carnet["url"]==cdav["url"]) {
      return true;
    }
  }
  return false;
}

/**
* Recherche si un carnet existe dans le courrielleur
*
* infos : tableau infos
* return true si present
*/
function cm2davCarnetExiste(infos) {

  let dirname=infos["prefid"];
  let prefdir=CM2DAV_PREF_LDAP2+dirname;

  let dirs=MailServices.ab.directories;

  while (dirs.hasMoreElements()) {
    let ab=dirs.getNext();

    if (ab instanceof Components.interfaces.nsIAbDirectory &&
        prefdir==ab.dirPrefId) {
      cm2DavTrace("cm2davCarnetExiste carnet existe");
      return true;
    }
  }

  return false;
}


/**
* Retourne identifiant réduit (partie gauche de .-.)
*/
function cm2davUidReduit(uid) {
  
  const compos=SplitUserBalp(uid);
  if (compos && 2==compos.length)
    return compos[0];

  return uid;
}

/**
* Listage des identifiants pacome
*
* @return array tableau d'identifiants (réduits)
*/
function cm2davListeUids() {

  cm2DavTrace("cm2davListeUids");
  let uids=new Array();

  if (Services.prefs.prefHasUserValue("pacome.ignoreuids")){
    
    let ignoreuids=Services.prefs.getCharPref("pacome.ignoreuids");
    cm2DavTrace("cm2davListeUids ignoreuids:"+ignoreuids);

    if (0!=ignoreuids.length && ""!=ignoreuids.length){

      ignoreuids=ignoreuids.split(";");

      for (let i=0;i<ignoreuids.length;i++){
        
        if (null==ignoreuids[i] || 0==ignoreuids[i].length) 
          continue;
        
        cm2DavTrace("cm2davListeUids  traitement ignoreuids:"+ignoreuids[i]);
        let ident=cm2davUidReduit(ignoreuids[i]);
        cm2DavTrace("cm2davListeUids uid reduit:"+ident);
        
        //ajout?
        let u=0;
        for (;u<uids.length;u++){
          if (ident==uids[u]) 
            break;
        }
        if (u==uids.length){
          cm2DavTrace("cm2davListeUids uid de boite:"+ident);
          uids.push(ident);
        }
      }
    }
  }

  //parcours des comptes
  let nb=MailServices.accounts.accounts.length;
  
  for (let c=0;c<nb;c++){
    
    let compte=MailServices.accounts.accounts.QueryElementAt(c,Components.interfaces.nsIMsgAccount);
    if ((null==compte)||(null==compte.incomingServer)) 
      continue;
    
    //test boite pacome
    if ("imap"!=compte.incomingServer.type && "pop3"!=compte.incomingServer.type) 
      continue;
    let confid=compte.incomingServer.getCharValue("pacome.confid");
    if (null==confid) 
      continue;
    
    //uid
    let uid=cm2davUidReduit(compte.incomingServer.username);
    
    //ajout
    let i=0;
    for (;i<uids.length;i++){
      if (uid==uids[i]) 
        break;
    }
    
    if (i==uids.length){
      cm2DavTrace("cm2davListeUids uid de boite:"+uid);
      uids.push(uid);
    }
  }

  return uids;
}

function cm2davUidPrincipal() {

  cm2DavTrace("cm2davUidPrincipal");

  let uid=PacomeAuthUtils.GetUidComptePrincipal();
  
  return uid;
}


/**
* Listage des carnets deja configurés dans le courrielleur par contactsdav
* - infos du carnet :
*       "url" : url complete
*       "prefid" : identifiant tb du carnet
*       "bookid" : identifiant horde du carnet
*       "uid" : identifiant
*       "displayname" : nom d'affichage
*       "readonly" : true si lecture seule ?
*       "getctag" : ctag du carnet
*
* mantis 0003333 : Permettre de choisir les carnets d'adresses horde affichés
*   ajout CM2DAV_PREFIXE_CARNETS+prefid+".libelle"  (sauvegarde displayname);
*         CM2DAV_PREFIXE_CARNETS+prefid+".affichage" (true|false)
*
* @return array tableau  des carnets d'adresses (voir cm2davListeCarnetsSrv)
*/
function cm2davListeCarnetsCm2() {

  cm2DavTrace("cm2davListeCarnetsCm2");
  let carnets=new Array();

  //CM2DAV_PREFIXE_CARNETS+dirname+".bookid" = identifiant carnet
  //CM2DAV_PREFIXE_CARNETS+dirname+".uid" = uid utilisateur
  //retrouver identifiants addressbook
  let prefBranch=Services.prefs.getBranch(CM2DAV_PREFIXE_CARNETS);
  let idents=new Array();
  let nb={value:0};
  let liste=prefBranch.getChildList("",nb);
  for (let i=0;i<nb.value;i++){
    let val=liste[i];
    let pos=val.indexOf(".bookid");
    if (0<pos) {
      let prefid=val.substr(0, pos);
      cm2DavTrace("cm2davListeCarnetsCm2 identifiant prefid:"+prefid);
      
      idents.push(prefid);
    }
  }

  //informations des carnets
  prefBranch=Services.prefs.getBranch(null);
  for (let prefid of idents) {
    let carnet=new Array();
    carnet["prefid"]=prefid;
    carnet["bookid"]=prefBranch.getCharPref(CM2DAV_PREFIXE_CARNETS+prefid+".bookid");
    carnet["uid"]=prefBranch.getCharPref(CM2DAV_PREFIXE_CARNETS+prefid+".uid");
    if (prefBranch.prefHasUserValue(CM2DAV_PREFIXE_CARNETS+prefid+".libelle"))
      carnet["libelle"]=prefBranch.getStringPref(CM2DAV_PREFIXE_CARNETS+prefid+".libelle");
    if (prefBranch.prefHasUserValue(CM2DAV_PREFIXE_CARNETS+prefid+".affichage"))
      carnet["affichage"]=prefBranch.getBoolPref(CM2DAV_PREFIXE_CARNETS+prefid+".affichage");
    
    if (prefBranch.prefHasUserValue(CM2DAV_PREF_SOGO+CM2DAV_PREF_LDAP2+prefid+".url"))
      carnet["url"]=prefBranch.getCharPref(CM2DAV_PREF_SOGO+CM2DAV_PREF_LDAP2+prefid+".url");
    if (prefBranch.prefHasUserValue(CM2DAV_PREF_SOGO+CM2DAV_PREF_LDAP2+prefid+".getctag"))
      carnet["getctag"]=prefBranch.getCharPref(CM2DAV_PREF_SOGO+CM2DAV_PREF_LDAP2+prefid+".getctag");
    if (prefBranch.prefHasUserValue(CM2DAV_PREF_LDAP2+prefid+".description"))
      carnet["displayname"]=prefBranch.getCharPref(CM2DAV_PREF_LDAP2+prefid+".description");
    
    carnets.push(carnet);
  }

  return carnets;
}


/**
* Obtenir la liste des carnets depuis le serveur pour un identifiant
*
* uid: identifiant utilisateur
* fnc: fonction de rappel - retour du tableau des carnets
*     fnc(status, carnets) => 2 arguments
*     status : code retour de la requête - 207 attendu
*     carnets : tableau d'infos des carnets.
*       - infos du carnet :
*       "url" : url complete
*       "prefid" : identifiant tb du carnet
*       "bookid" : identifiant horde du carnet
*       "uid" : identifiant
*       "displayname" : nom d'affichage
*       "readonly" : true si lecture seule
*       "getctag" : ctag du carnet
*/
function cm2davListeCarnetsSrv(uid, fnc) {
  
  cm2DavTrace("cm2davListeCarnetsSrv uid:"+uid);

  let carnets=new Array();

  let userurl=cm2davGetUserUrl(uid);
  cm2DavTrace("cm2davListeCarnetsSrv userurl:"+userurl);

  let traces=cm2DavTrace;
  let target={
    
    onDAVQueryComplete: function(status, response, headers, cbData) {
      traces("cm2davListeCarnetsSrv onDAVQueryComplete status:"+status);
      cm2DavEcritLog(CM2DAV_LOGS_CFG, "Reponse du serveur - status:", status);
      //
      if (status > 199 && status < 400 && response) {
        let responses = response["multistatus"][0]["response"];

        for (let response of responses) {
          let href = response["href"][0];
          traces("cm2davListeCarnetsSrv onDAVQueryComplete href:"+href);
          let propstats = response["propstat"];
          for (let propstat of propstats) {

            if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
              for (let prop of propstat["prop"]) {

                if (prop["resourcetype"]) {
                  let srctype=prop["resourcetype"][0];
                  if (srctype["addressbook"]) {

                    traces("cm2davListeCarnetsSrv onDAVQueryComplete => carnet d'adresses");
                    let displayname="";
                    let readonly=false;
                    let getctag=0;
                    if (prop["displayname"]) {
                      displayname=prop["displayname"][0];
                      traces("cm2davListeCarnetsSrv onDAVQueryComplete displayname:"+displayname);
                    }
                    if (prop["readonly"]) {
                      readonly=prop["readonly"][0];
                      traces("cm2davListeCarnetsSrv onDAVQueryComplete readonly:"+readonly);
                    }
                    if (prop["getctag"]) {//a priori pas necessaire
                      getctag=prop["getctag"][0];
                      traces("cm2davListeCarnetsSrv onDAVQueryComplete getctag:"+getctag);
                    }

                    //construire informations du carnet d'adresses
                    let carnet=cm2davGetInfosFromHref(href);
                    carnet["displayname"]=displayname;
                    carnet["readonly"]=readonly;
                    carnet["getctag"]=getctag;
                    cm2DavEcritLog(CM2DAV_LOGS_CFG, "Carnet retourne par le serveur - href:", href);
                    carnets.push(carnet);
                  }
                }
              }
            }
          }
        }

      } else {
        //reporter erreur
        cm2DavEcritLog(CM2DAV_LOGS_CFG, "Listage des carnet du serveur code retour:"+status);
      }
      //retour des resultats
      if (null!=fnc)
        fnc(status, carnets);
    }
  }

  //callback data
  //let data={query: "server-check-propfind"};
  let data={query: "listage-carnets"};

  cm2DavEcritLog(CM2DAV_LOGS_CFG, "Requete serveur - url:", userurl);

  let req=new sogoWebDAV(userurl, target, data);

  req.propfind(["DAV: resourcetype", "DAV: displayname",
                "http://courrielleur.melanie2.i2/ns/ readonly",
                "http://calendarserver.org/ns/ getctag"], true);
}


/**
* Retourne des informations a partir de la propriete href d'un carnet
* pour utilisation dans cm2davListeCarnetsSrv
* href : valeur href retournee par le serveur (url complete apres hostname)
* ex: "/contacts.php/carnets/philippe.martinak2/719c532de9c00ece91a4252bfccc8b23/"
*
*       - infos du carnet :
*       "url" : url complete
*       "prefid" : identifiant tb du carnet
*       "bookid" : identifiant horde du carnet
*       "uid" : identifiant
*
* return tableau avec uid (identifiant utilisateur), url, bookid (identifiant carnet)
*/
function cm2davGetInfosFromHref(href) {

  let infos=new Array();

  let compos=href.split("/");
  if (6>compos.length) {
    cm2DavTrace("cm2davGetInfosFromHref valeur href non conforme:"+href);
    return null;
  }
  //url
  let srv=cm2davGetCm2DavSrvName();
  let url=CM2DAV_PROTO+srv+href;
  infos["url"]=url;
  //uid
  infos["uid"]=compos[3];
  //bookid
  infos["bookid"]=compos[4];
  //bookid
  infos["prefid"]=cm2davDirName(compos[4]);

  return infos;
}


/**
* Retourne url du serveur Cm2Dav
*/
let gCm2davSrvName=null;
function cm2davGetCm2DavSrvName() {

  if (null!=gCm2davSrvName)
    return gCm2davSrvName;
  
  //CM2DAV_PREF_SERVER_NAME

  gCm2davSrvName=Services.prefs.getCharPref(CM2DAV_PREF_SERVER_NAME);
  return gCm2davSrvName;
}

/**
* Construit l'url serveur pour un uid
*/
function cm2davGetUserUrl(uid) {

  let srv=Services.prefs.getCharPref(CM2DAV_PREF_SERVER_NAME);
  let racine=Services.prefs.getCharPref(CM2DAV_PREF_SERVER_RACINE);

  let url=CM2DAV_PROTO+srv+"/"+racine+uid+"/";

  return url;
}

/**
* Contruit l'identifiant d'un carnet
* valeur passée avec caractères numériques et alpha
*/
function cm2davDirName(str) {
  return str.replace(/[^\w]/g, "");
}

/**
* Suppression d'un carnet d'adresses
* prefid : identifiant tb du carnet
*
* mantis 0003333: Permettre de choisir les carnets d'adresses horde affichés
*       ne pas supprimer les preferences courrielleur => marquer affichage a false
* return true si succes
*/
function cm2davSupprimeCarnet(prefid) {
  
  cm2DavTrace("cm2davSupprimeCarnet prefid:"+prefid);

  let prefdir=CM2DAV_PREF_LDAP2+prefid;

  let dirs=MailServices.ab.directories;

  let carnet=null;

  while (dirs.hasMoreElements()) {
    let ab=dirs.getNext();

    if (ab instanceof Components.interfaces.nsIAbDirectory &&
        prefdir==ab.dirPrefId) {
      cm2DavTrace("cm2davSupprimeCarnet carnet existe");
      carnet=ab;
      break;
    }
  }

  if (null==carnet) {
    cm2DavTrace("cm2davSupprimeCarnet carnet inexistant");
    return false;
  }
  
  //mantis 0003333:ne pas supprimer les preferences courrielleur => marquer affichage a false
  //memoriser libelle
  //courrielleur
  Services.prefs.setBoolPref(CM2DAV_PREFIXE_CARNETS+prefid+".affichage", false);
  let lib=Services.prefs.getCharPref(CM2DAV_PREF_LDAP2+prefid+".description");
  Services.prefs.setCharPref(CM2DAV_PREFIXE_CARNETS+prefid+".libelle", lib);

  cm2DavTrace("cm2davSupprimeCarnet carnet.URI:"+carnet.URI);
  MailServices.ab.deleteAddressBook(carnet.URI);

  //Sogo
  Services.prefs.deleteBranch(CM2DAV_PREF_SOGO+CM2DAV_PREF_LDAP2+prefid);
  
  // supprimer les preferences sogo des listes
  let prefs=Services.prefs.getBranch(CM2DAV_PREF_SOGO);
  let prefNames=prefs.getChildList("", {});
  for (var m of prefNames) {
    if (0==m.indexOf(prefid+"_MailList")){
      Services.prefs.clearUserPref(CM2DAV_PREF_SOGO+m);
    }
  }
  
  Services.prefs.savePrefFile(null);

  return true;
}

/**
* Ajout d'un carnet d'adresses
* infos: tableau d'infos du carnet (voir cm2davListeCarnetsSrv)
*
* mantis 0003333: Permettre de choisir les carnets d'adresses horde affichés
*
* return true si creation ok
*/
function cm2davAjoutCarnet(infos) {

  cm2DavTrace("cm2davAjoutCarnet bookid:"+infos["bookid"]);

  //lecture seule?
  let dirname=infos["prefid"];

  let prefId=MailServices.ab.newAddressBook(infos["displayname"], null, 2, CM2DAV_PREF_LDAP2+dirname);
  cm2DavTrace("cm2davAjoutCarnet prefId:"+prefId);

  //Sogo
  let groupdavPrefService=new GroupdavPreferenceService(prefId);
  groupdavPrefService.setURL(infos["url"]);

  //courrielleur
  //CM2DAV_PREFIXE_CARNETS+dirname+".bookid" = identifiant carnet
  //CM2DAV_PREFIXE_CARNETS+dirname+".uid" = uid utilisateur
  let prefBranch=Services.prefs.getBranch(null);
  prefBranch.setCharPref(CM2DAV_PREFIXE_CARNETS+dirname+".bookid", infos["bookid"]);
  prefBranch.setCharPref(CM2DAV_PREFIXE_CARNETS+dirname+".uid", infos["uid"]);
  
  //mantis 0003333
  prefBranch.setStringPref(CM2DAV_PREFIXE_CARNETS+dirname+".libelle", infos["displayname"]);
  prefBranch.setBoolPref(CM2DAV_PREFIXE_CARNETS+dirname+".affichage", true);
  
  //lecture seule?
  if ("true"==infos["readonly"]) {
    cm2DavTrace("cm2davAjoutCarnet carnet en lecture seule");
    prefBranch.setBoolPref(prefId+".readonly", true);
  }

  Services.prefs.savePrefFile(null);

  return true;
}

/**
* Mise a jour d'un carnet d'adresses
* infos: tableau d'infos du carnet (voir cm2davListeCarnetsSrv)
*
* mantis 0003333: Permettre de choisir les carnets d'adresses horde affichés
*
*/
function cm2davMajCarnet(infos) {
  cm2DavTrace("cm2davMajCarnet bookid:"+infos["bookid"]);

  //lecture seule?
  let dirname=infos["prefid"];
  cm2DavTrace("cm2davMajCarnet prefid:"+infos["prefid"]);
  let prefdir=CM2DAV_PREF_LDAP2+dirname;

  let dirs=MailServices.ab.directories;
  let carnet=null;

  while (dirs.hasMoreElements()) {
    let ab=dirs.getNext();

    if (ab instanceof Components.interfaces.nsIAbDirectory &&
        prefdir==ab.dirPrefId) {
      cm2DavTrace("cm2davMajCarnet carnet existe");
      carnet=ab;
      break;
    }
  }

  if (null==carnet) {
    cm2DavTrace("cm2davMajCarnet carnet inexistant");
    return false;
  }

  carnet.dirName=infos["displayname"];

  //Sogo
  let groupdavPrefService=new GroupdavPreferenceService(carnet.dirPrefId);
  groupdavPrefService.setURL(infos["url"]);

  //courrielleur
  //CM2DAV_PREFIXE_CARNETS+dirname+".bookid" = identifiant carnet
  //CM2DAV_PREFIXE_CARNETS+dirname+".uid" = uid utilisateur
  let prefBranch=Services.prefs.getBranch(null);
  prefBranch.setCharPref(CM2DAV_PREFIXE_CARNETS+dirname+".bookid", infos["bookid"]);
  prefBranch.setCharPref(CM2DAV_PREFIXE_CARNETS+dirname+".uid", infos["uid"]);
  //mantis 0003333
  prefBranch.setStringPref(CM2DAV_PREFIXE_CARNETS+dirname+".libelle", infos["displayname"]);
  if (!prefBranch.prefHasUserValue(CM2DAV_PREFIXE_CARNETS+dirname+".affichage"))
    prefBranch.setBoolPref(CM2DAV_PREFIXE_CARNETS+dirname+".affichage", true); 

  //lecture seule?
  if ("true"==infos["readonly"]) {
    cm2DavTrace("cm2davMajCarnet carnet en lecture seule");
    prefBranch.setBoolPref(prefdir+".readonly", true);
  } else {
    prefBranch.setBoolPref(prefdir+".readonly", false);
  }

  Services.prefs.savePrefFile(null);

  return true;
}

/**
* Migration vers le nouveau serveur (version 2.4)
* syncon.melanie2.i2 => syncon.s2.m2.e2.rie.gouv.fr
* carnetsCm2 : tableau des carnets retourné par la fonction cm2davListeCarnetsCm2
*/
function cm2davMigreNouvNoms(carnetsCm2) {

  for (let carnet of carnetsCm2) {
    let url=carnet["url"];
    if (null!=url && 0==url.indexOf("https://syncon.melanie2.i2/")){
      carnet["url"]=url.replace("https://syncon.melanie2.i2/", "https://syncon.s2.m2.e2.rie.gouv.fr/");
      cm2DavTrace("Carnet migre sur le nouveau nom:"+carnet["url"]);
    }
  }
}


//v3.0 - Bug mantis 0004251: Les carnets supprimés sur le serveur sont toujours listés dans la boîte d'affichage
// mettre a jour carnet supprimes
//carnetsDav : tableau des carnets serveur
function cm2davMajListeCarnetAff(carnetsDav){
  
  let prefBranch=Services.prefs.getBranch(CM2DAV_PREFIXE_CARNETS);
  
  //listage identifiants memorises
  let nb={};
  let prefs=prefBranch.getChildList("", nb);
  for (var i=0; i<prefs.length; i++){
    
    let val=prefs[i].split(".");
    let prefid=val[0];
    
    if ("bookid"==val[1]){
      cm2DavTrace("cm2davMajListeCarnetAff prefid:"+prefid);
      let present=false;
      for (var carnet of carnetsDav){
        if (prefid==carnet["prefid"]){
          present=true;
          break;
        }
      }
      if (!present){
        cm2DavTrace("cm2davMajListeCarnetAff carnet n'existe plus prefid:"+prefid);
        Services.prefs.deleteBranch(CM2DAV_PREFIXE_CARNETS+prefid);
      }
    }
  }
}
