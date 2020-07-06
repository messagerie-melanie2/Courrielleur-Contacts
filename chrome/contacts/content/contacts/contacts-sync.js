/**
* Module contacts du courrielleur
* Fichier pour la synchronisation d'un contacts
* Ne réalise pas une synchronisation complete du carnet (!= de sogo)
* Gere automatiquement les conflits serveur (contact modifie sur le serveur depuis la dernière synchro)
* Ne synchronise pas si offline
* depend de sogoWebDAV.js
*/

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");


//cm2 - module contacts
//liste des attributs de contact suppportes par la synchro
const CM2DAV_CHAMPS=["BirthYear",
                      "LastName",
                      "Company",
                      "HomeZipCode",
                      "NickName",
                      "DisplayName",
                      "WorkZipCode",
                      "WorkAddress",
                      "HomeCountry",
                      "WorkPhone",
                      "PrimaryEmail",
                      "HomeAddress",
                      "WorkCity",
                      "SecondEmail",
                      "FaxNumber",
                      "FirstName",
                      "HomeCity",
                      "PagerNumber",
                      "CellularNumber",
                      "BirthDay",
                      "WebPage1",
                      "Notes",
                      "HomePhone",
                      "BirthMonth",
                      "Categories",
                      "JobTitle",
                      "WorkCountry",
                      "ThirdEmail"];


/**
* Fonction globale pour la synchronisation d'un contact
* appelee depuis sogo avec setTimeout
*/
function cm2SynchroniseContact(newCard, oldCard=null){
  
  let synchroniseur;
  
  if (!newCard.isMailList){
    cm2DavTrace("Synchronisation d'un contact");
    synchroniseur=new cm2SynchroContact(newCard, oldCard);
    
    synchroniseur.synchronise();
    
  } else
    cm2DavTrace("Synchronisation d'un contact: pas un contact");
}



/**
* Classe cm2SynchroContact : gere la synchronisation d'un contact
*
* newCard: contact modifie dans l'ui
* oldCard: contact non modifie (original)
*/

// type de requete en cours
const CM2_SYNCHRO_NONE=1;
const CM2_SYNCHRO_GET_CO=2;
const CM2_SYNCHRO_PUT_CO=4;
const CM2_SYNCHRO_GET_LIST=8;
const CM2_SYNCHRO_PUT_LIST=16;


// newCard: instance contact
// oldCard: copie originale de newCard (non modifiee) si edition
function cm2SynchroContact(newCard, oldCard){
  
  this.newCard=newCard;
  this.oldCard=oldCard;
  
  if (this.newCard){
    
    let dirId=this.newCard.directoryId.substring(0, this.newCard.directoryId.indexOf("&"));;
    this.abook=MailServices.ab.getDirectoryFromId(dirId);
  }
  
  if (this.abook){
    
    this.srvurl=Services.prefs.getCharPref("extensions.ca.inverse.addressbook.groupdav."+
                                            this.abook.dirPrefId+".url");
    cm2DavTrace("Synchronisation d'un contact - url serveur du carnet:"+this.srvurl);
  }
}

cm2SynchroContact.prototype={
  
  newCard:null,
  oldCard:null,
  // carnet d'adresse
  abook:null,
  // url du carnet sur le serveur
  srvurl:null,
  //type de requete en cours
  typereq:CM2_SYNCHRO_NONE,
  // etag serveur
  srvEtag:null,
   
  // methode principale de synchronisation
  synchronise:function(){
    
    if (null==this.srvurl || null==this.newCard){
      cm2DavTrace("Synchronisation d'un contact - donnees non initialisees");
      return;
    }
    
    if (Services.io.offline){
      cm2DavTrace("Synchronisation d'un contact - client hors ligne");
      return;
    }
    
    // nouveau contact
    if (null==this.oldCard){      
      
      let key=this.newCard.getProperty(kNameKey, "");
      if (""==key){
        key=String(new UUID());
        cm2DavTrace("Synchronisation d'un nouveau contact identifiant:"+key);
        this.newCard.setProperty(kNameKey, key);       
        this.abook.modifyCard(this.newCard);
      }
      
      this.updateServeur(this.newCard);
      
      return;
    }
    
    
    // modification d'un contact
    // recuperer etag du serveur
    let key=this.newCard.getProperty(kNameKey, "");
    let cardURL=this.srvurl+key;
    cm2DavTrace("Synchronisation d'un contact - url du contact:"+cardURL);
    this.srvEtag=this.getSrvEtag(cardURL);
    cm2DavTrace("Synchronisation d'un contact - etag serveur:"+this.srvEtag);
    dump("  etag serveur:"+this.srvEtag+"\n");
    
    // comparer les etag client et serveur
    let clientEtag=this.newCard.getProperty("groupDavVersionPrev", "");
    cm2DavTrace("Synchronisation d'un contact - etag client:"+clientEtag);
    dump("  etag client:"+clientEtag+"\n");
    
    // si srvEtag null => le contact a été supprimé du serveur => on ecrit quand même
    if (null==this.srvEtag ||
        clientEtag==this.srvEtag){
      
      // envoyer le contact modifie
      this.updateServeur(this.newCard);
      
    } else {     
      // synchroniser avec fusion automatique des modifications
      this.syncModications(this.newCard);
    }
    
  },
 
  // recupere l'etag serveur du contact
  // carduri : url du contact
  getSrvEtag:function(carduri){
    
    // code sogo (sync.addressbook.groupdav.js)
    let etag = null;
    let retourEtag = {
      onDAVQueryComplete: function(status, response, headers, data) {
        if (status > 199 && status < 400) {
          let responses = response["multistatus"][0]["response"];
          for (let response of responses) {
            let href = response["href"][0];
            let propstats = response["propstat"];
            for (let propstat of propstats) {
              if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
                let prop = propstat["prop"][0];
                if (prop["getetag"] && prop["getetag"].length > 0) {
                  etag = prop["getetag"][0];
                }
              }
            }
          }
        }
      }
    };
    
    let request = new sogoWebDAV(carduri, retourEtag, null, true, true);
    request.requestJSONResponse = true;
    request.propfind(["DAV: getetag"], false);
    
    return etag;
  },
         
  onDAVQueryComplete: function(status, response, headers, data) {
    
    if (CM2_SYNCHRO_PUT_CO==this.typereq)   
      this.onCardUpload(status, response, headers, data);     
    else if (CM2_SYNCHRO_GET_CO==this.typereq)
      this.onCardDownload(status, response, headers, data);
  },
  
  // onDAVQueryComplete cas CM2_SYNCHRO_PUT_CO
  onCardUpload:function(status, response, headers, data){
    
    cm2DavTrace("Synchronisation d'un contact - reponse du serveur status:"+status);
    if (status > 199 && status < 400) {
      
      let etag=headers["etag"];
      if (etag && etag.length) {
        
        this.newCard.setProperty(kETagKey, "" + String(etag));
        this.abook.modifyCard(this.newCard);        
        cm2DavTrace("Synchronisation d'un contact - nouveau etag serveur:"+etag);
        
      } else
        cm2DavTrace("Synchronisation d'un contact - le serveur n'a pas retourne un nouveau etag");
    }
  },
  
  // met a jour le contact sur le serveur
  updateServeur:function(card){
    
    // contact
    let vcard=card2vcard(card);
    dump("*** updateServeur vcard: "+vcard+"\n");
    let key=card.getProperty(kNameKey, "");
    let data={query: "card-upload", data: card, key: key};
    let cardURL=this.srvurl+key;
    let request=new sogoWebDAV(cardURL, this, data);
    cm2DavTrace("Synchronisation d'un contact - envoi du contact au serveur");
    this.typereq=CM2_SYNCHRO_PUT_CO;
    
    request.put(vcard, "text/vcard; charset=utf-8");
  },
  
  // synchronisation avec fusion des modifications 
  syncModications:function(card){
    
    // recuperer le contact serveur pour fusion des modications avant envoi
    let key=card.getProperty(kNameKey, "");
    this.getContactServeur(key);
  },
  
  // recupere le contact serveur (cas etag pas a jour)
  getContactServeur:function(key){
    
    let cardURL=this.srvurl+key;
    let data={query: "vcard-download", data: key};
    let request=new sogoWebDAV(cardURL, this, data);
    this.typereq=CM2_SYNCHRO_GET_CO;
    request.get("text/vcard");
  },
  
  // onDAVQueryComplete cas CM2_SYNCHRO_GET_CO
  onCardDownload:function(status, response, headers, data){
    
    cm2DavTrace("Telechargement du contact - reponse du serveur status:"+status);
    dump("onCardDownload reponse du serveur status:"+status+"\n")
    
    function checkTypeCard(response){
      
      if (response && 11<response.length){
        //begin:vcard    
        let str=response.substr(0, 11);
        if ("begin:vcard"==str.toLowerCase())
          return true;
      }
      
      return false;
    }

    if (Components.isSuccessCode(status) &&
        data && data.data
        && checkTypeCard(response)){
          
      cm2DavTrace("Telechargement du contact - response:"+response);
      let srvCard=importFromVcard(response);   
      
      // gerer les conflits (fusion contacts serveur et client)
      this.mergeModifications(this.newCard, this.oldCard, srvCard);
           
      // envoi du contact modifie au serveur
      this.newCard.setProperty(kETagKey, -1);
      this.newCard.setProperty("groupDavVersionPrev", this.srvEtag);
      this.abook.modifyCard(this.newCard);
      
      this.updateServeur(this.newCard);      
    
    } else
      cm2DavTrace("Telechargement du contact - echec des conditions");
  },
  
  // fusion automatique des contacts serveur et client
  // cas contact modifie sur le serveur depuis derniere synchro
  mergeModifications:function(modifie, original, serveur){
    
    cm2DavTrace("Fusion des modifications serveur et client");
    
    let propSrv=this.listeProperties(serveur);
    let propNew=this.listeProperties(modifie);
    let propOld=this.listeProperties(original);
    
    for (var propName of CM2DAV_CHAMPS){
      
      let inSrv=propSrv.includes(propName);    
      let inOld=propOld.includes(propName);
      let inNew=propNew.includes(propName);
      dump("  mergeModifications propName:"+propName+" - inSrv:"+(inSrv?"true":"false")+
      " - inOld:"+(inOld?"true":"false")+" - inNew:"+(inNew?"true":"false")+"\n");
      
      let valOld=original.getProperty(propName, "");    
      let valNew=modifie.getProperty(propName, "");
      let valSrv=serveur.getProperty(propName, "");
      dump("    mergeModifications valOld:'"+valOld+"' - valNew:'"+valNew+"' - valSrv:'"+valSrv+"'\n");
      
      // valeurs non modifiees en local
      if (valOld==valNew){
              
        if (0==valSrv.length){
          // supprimees sur le serveur
          if (""!=valNew){
            dump("  mergeModifications effacement valeur de:"+propName+"\n");
            modifie.setProperty(propName, "");
          }          
          
        } else if (valSrv!=valNew){          
          // modifiee ou nouvelle sur le serveur
          dump("  mergeModifications modification valeur de:"+propName+" - valeur:"+valSrv+"\n");
          modifie.setProperty(propName, valSrv);
        }       
      }
    }
  },
  
  // liste les noms des propriétés existantes
  // retourne un tableau de noms
  listeProperties:function(card){
    
    let props=[];
    let allProperties=card.properties;
    while (allProperties.hasMoreElements()) {
      let prop=allProperties.getNext().QueryInterface(Components.interfaces.nsIProperty);
      let propName=String(prop.name);
      if (CM2DAV_CHAMPS.includes(propName)) 
        props.push(propName);
    }
    return props;
  }
}





/**
* Fonction globale pour la synchronisation d'une liste
* appelee depuis sogo avec setTimeout
* newList: liste modifiee dans l'ui  (nsIAbDirectory)
* oldList: liste non modifiee (originale)  (nsIAbDirectory)
*/
function cm2SynchroniseListe(newList, oldList=null){
  
  let synchroniseur;
  
  if (newList.isMailList){
    cm2DavTrace("Synchronisation d'une liste");
    synchroniseur=new cm2SynchroListe(newList, oldList);
    
    synchroniseur.synchronise();
    
  } else
    cm2DavTrace("Synchronisation d'une liste : pas une liste");
}

/**
* Classe cm2SynchroListe : gere la synchronisation d'une liste
* similaire a cm2SynchroContact mais specialisee liste
*
* newList: liste modifiee dans l'ui  (nsIAbDirectory)
* oldList: liste non modifiee (originale)  (nsIAbDirectory)
*/

// newList: instance contact
// oldList: copie originale de newList (non modifiee) si edition
function cm2SynchroListe(newList, oldList){

  this.newList=newList;
  this.oldList=oldList;
  
  //tests
  if (oldList){
    let nbCards=oldList.addressLists.length;
    for (let index=0; index<nbCards; index++) {
      let card=oldList.addressLists.queryElementAt(index, Components.interfaces.nsIAbCard);
      dump("*** cm2SynchroListe oldList card:"+card.primaryEmail+"\n"); 
    }  
  }
  
  if (this.newList){
    
    this.attrs=new GroupDAVListAttributes(newList.URI);
    
    let parentURI=GetParentDirectoryFromMailingListURI(newList.URI);
    this.abook=MailServices.ab.getDirectory(parentURI);
  }
  
  if (this.abook){
    
    this.srvurl=Services.prefs.getCharPref("extensions.ca.inverse.addressbook.groupdav."+
                                            this.abook.dirPrefId+".url");
    cm2DavTrace("Synchronisation d'une liste - url serveur du carnet:"+this.srvurl);
  }
}

cm2SynchroListe.prototype={
  
  newList:null,
  oldList:null,
  // GroupDAVListAttributes
  attrs:null,
  
  // carnet d'adresse
  abook:null,
  // url du carnet sur le serveur
  srvurl:null,
  //type de requete en cours
  typereq:CM2_SYNCHRO_NONE,
  // etag serveur
  srvEtag:null,
   
  // methode principale de synchronisation
  synchronise:function(){
    
    dump("cm2SynchroListe synchronise\n");
    
    if (null==this.srvurl || null==this.newList){
      cm2DavTrace("Synchronisation d'une liste - donnees non initialisees");
      return;
    }
    
    if (Services.io.offline){
      cm2DavTrace("Synchronisation d'une liste - client hors ligne");
      return;
    }
    
    // nouvelle liste
    if (null==this.oldList){      
      dump("cm2SynchroListe synchronise null==this.oldList\n");
            
      let key="";
      try{
        key=this.attrs.key;
      }catch(ex){}
      
      if (null==key || ""==key){
        key=String(new UUID());
        this.attrs.key=key;       
      }
      cm2DavTrace("Synchronisation d'un nouvelle liste identifiant:"+key);
      
      this.updateServeur(this.newList);
      
      return;
    }
    
    
    // modification d'une liste
    // recuperer etag du serveur
    let key=this.attrs.key;
    cm2DavTrace("Modification d'un liste:"+key);
    let listUrl=this.srvurl+key;
    cm2DavTrace("Synchronisation d'une liste - url de la liste:"+listUrl);
    this.srvEtag=this.getSrvEtag(listUrl);
    cm2DavTrace("Synchronisation d'une liste - etag serveur:"+this.srvEtag);
    dump("  etag serveur:"+this.srvEtag+"\n");
    
    // comparer les etag client et serveur
    let clientEtag=this.attrs.versionprev;
    cm2DavTrace("Synchronisation d'une liste - etag client:"+clientEtag);
    dump("  etag client:"+clientEtag+"\n");
    
    // si srvEtag null => le contact a été supprimé du serveur => on ecrit quand même
    if (null==this.srvEtag ||
        clientEtag==this.srvEtag){
      
      // envoyer le contact modifie
      this.updateServeur(this.newList);
      
    } else {
      
      // synchroniser avec fusion automatique des modifications
      this.syncModications(this.newList);
    }
    
  },
 
  // recupere l'etag serveur du contact
  // listuri : url du contact
  getSrvEtag:function(listuri){
    
    // code sogo (sync.addressbook.groupdav.js)
    let etag = null;
    let retourEtag = {
      onDAVQueryComplete: function(status, response, headers, data) {
        if (status > 199 && status < 400) {
          let responses = response["multistatus"][0]["response"];
          for (let response of responses) {
            let href = response["href"][0];
            let propstats = response["propstat"];
            for (let propstat of propstats) {
              if (propstat["status"][0].indexOf("HTTP/1.1 200") == 0) {
                let prop = propstat["prop"][0];
                if (prop["getetag"] && prop["getetag"].length > 0) {
                  etag = prop["getetag"][0];
                }
              }
            }
          }
        }
      }
    };
    let request = new sogoWebDAV(listuri, retourEtag, null, true, true);
    request.requestJSONResponse = true;
    request.propfind(["DAV: getetag"], false);
    
    return etag;
  },
         
  onDAVQueryComplete: function(status, response, headers, data) {
    
    if (CM2_SYNCHRO_PUT_LIST==this.typereq)
      this.onListUpload(status, response, headers, data);
    else if (CM2_SYNCHRO_GET_LIST==this.typereq)
      this.onListDownload(status, response, headers, data);
  },
  
  // onDAVQueryComplete cas CM2_SYNCHRO_PUT_LIST
  onListUpload:function(status, response, headers, data){
    
    cm2DavTrace("Synchronisation d'une liste - reponse du serveur status:"+status);
    if (status > 199 && status < 400) {
      
      let etag=headers["etag"];
      if (etag && etag.length) {

        let attributes=new GroupDAVListAttributes(data.data.mailListURI);
        attributes.version=etag;
        Services.prefs.savePrefFile(null);
        
        dump("  Synchronisation d'une liste key:"+attributes.key+" - nouveau etag serveur:"+etag+"\n");
        cm2DavTrace("Synchronisation d'une liste - nouveau etag serveur:"+etag);
      }
      else
        cm2DavTrace("Synchronisation d'une liste - le serveur n'a pas retourne un nouveau etag");
    }
  },
  
  // met a jour la liste sur le serveur
  updateServeur:function(liste){
    dump("cm2SynchroListe updateServeur\n");
    
    // envoyer les nouveaux contacts (cas membres créés par tb)
    this.envoieContacts(liste);
    
    // liste
    let key=this.attrs.key;
    let card=this.getCardForList(liste);
    let vList=list2vlist(key, card);
    dump("*** updateServeur vList: "+vList+"\n");
    let listUrl=this.srvurl+key;
    let data={query: "list-upload",
              data: card,
              key: key};
    let request=new sogoWebDAV(listUrl, this, data);
    this.typereq=CM2_SYNCHRO_PUT_LIST;
    cm2DavTrace("Synchronisation d'une liste - envoi de la liste au serveur url:"+listUrl);
    
    request.put(vList, "text/x-vlist; charset=utf-8");
  },
  
  // synchronisation avec fusion des modifications 
  syncModications:function(liste){
    dump("cm2SynchroListe syncModications\n");
  
    // recuperer la liste serveur pour fusion des modications avant envoi
    let key=this.attrs.key;
    this.geListeServeur(key);
  },
  
  // recupere la liste serveur (cas etag pas a jour)
  geListeServeur:function(key){
    
    let listUrl=this.srvurl+key;
    let data={query: "vList-download", data: key};
    let request=new sogoWebDAV(listUrl, this, data);
    this.typereq=CM2_SYNCHRO_GET_LIST;
    request.get("text/x-vlist");
  },
  
  // onDAVQueryComplete cas CM2_SYNCHRO_GET_LIST
  onListDownload:function(status, response, headers, data){
    
    cm2DavTrace("Telechargement de la liste - reponse du serveur status:"+status);
    dump("onListDownload - reponse du serveur status:"+status+"\n");
    
    function checkTypeList(response){
      if (response && 11<response.length){
        //begin:vlist    
        let str=response.substr(0, 11);
        if ("begin:vlist"==str.toLowerCase())
          return true;
      }
      return false;
    }

    if (Components.isSuccessCode(status) &&
        data && data.data
        && checkTypeList(response)){
          
      cm2DavTrace("Telechargement de la liste - response:"+response);
      let srvList=versitParse(response);   
      
      // gerer les conflits (fusion contacts serveur et client)
      this.mergeModifications(this.newList, this.oldList, srvList);
        
      // envoi de la liste modifiee au serveur
       dump("onListDownload - envoi de la liste modifiee au serveur\n");
      this.attrs.version=-1;
      this.attrs.versionprev=this.srvEtag;
      
      this.updateServeur(this.newList);   
    
    } else{
      cm2DavTrace("Telechargement de la liste - echec des conditions");
      dump("onListDownload echec des conditions\n");
    }
    
  },
  
  // fusion automatique des contacts serveur et client
  // cas contact modifie sur le serveur depuis derniere synchro
  // modifie (nsIAbDirectory)
  // original (nsIAbDirectory)
  // serveur (tableau retour versitParse)
  mergeModifications:function(modifie, original, serveur){
    
    cm2DavTrace("Fusion des modifications serveur et client");
    let bmodif=false;
    
    /* proprietes */
    // fn
    let srvFn;
    // nickname
    let srvAlias;
    // description
    let srvDesc;
    
    for (let i=0;i<serveur.length;i++) {
      let line=serveur[i];
      if ("fn"==line.tag) 
        srvFn=line.values[0];
      else if ("nickname"==line.tag)
        srvAlias=line.values[0];
      else if ("description"==line.tag)
        srvDesc=line.values[0];
    }
    
    let cardModif=this.getCardForList(modifie);
    
    // fn
    if (modifie.dirName==original.dirName && 
        srvFn!=modifie.dirName){
      modifie.dirName=srvFn;    
      cardModif.displayName=srvFn;    
      cardModif.lastName=srvFn;
      bmodif=true;
    }
    
    // nickname
    if (modifie.listNickName==original.listNickName && 
        srvAlias!=modifie.listNickName){
      modifie.listNickName=srvAlias;    
      cardModif.setProperty("NickName", srvAlias);
      bmodif=true;  
    }
    
    // description
    if (modifie.description==original.description && 
        srvDesc!=modifie.description){
      modifie.description=srvDesc;    
      cardModif.setProperty("Notes", srvDesc);
      bmodif=true;
    }
       
    
    /* membres */
    let adrSrv=[];
    for (let i=0;i<serveur.length;i++) {
      let line=serveur[i];
      if ("card"==line.tag) {
        let email = line.parameters["email"][0];
        if (email) {
          email=email.replace(/[\r\n\s]*/g, "");
          adrSrv.push(email);
        }
      }
    }
    
    dump("  *mergeModifications _getEmailMembres original\n");
    let adrOld=this._getEmailMembres(original);
    dump("  *mergeModifications _getEmailMembres modifie\n");
    let adrModif=this._getEmailMembres(modifie);
    
    // ajouts (dans adrSrv et pas dans adrModif et adrOld)
    let nb=adrSrv.length;
    for (let i=0;i<nb;i++){
      let email=adrSrv[i];
      if (!adrOld.includes(email) && 
          !adrModif.includes(email)){
        // ajout    
        let card=this._findCardWithEmail(email);
        if (card){
          dump("  mergeModifications ajout membre email:"+email+"\n");
          modifie.addressLists.appendElement(card, false);
          bmodif=true;
        } else{
          dump("!!! mergeModifications ajout membre email:"+email+"  non trouve\n");
        }          
      }
    }
    
    // suppressions (dans adrModif et adrOld pas dans adrSrv)
    nb=adrModif.length;
    for (let i=0;i<nb;i++){
      let email=adrModif[i];
      if (!adrOld.includes(email))
        continue;
      if (!adrSrv.includes(email)){
        // suppression
        let nbCards=modifie.addressLists.length;
        for (let index=0; index<nbCards; index++) {
          let card=modifie.addressLists.queryElementAt(index, Components.interfaces.nsIAbCard);
          if (card.isMailList)
            continue;
          let email2=card.primaryEmail;
          if (null==email2 && ""==email2)
            continue;
          if (email==email2){
            dump(" mergeModifications suppression membre email:"+email+"\n");
            modifie.addressLists.removeElementAt(index);
            nbCards=modifie.addressLists.length;
            bmodif=true;
          }
        }
      }
    }
      
    if (bmodif){
      modifie.editMailListToDatabase(cardModif);
    }

  },
  
  // extrait les email membres d'une liste
  _getEmailMembres:function(liste){
    
    let adrs=[];
    let nbCards=liste.addressLists.length;
    for (let index=0; index<nbCards; index++) {
      let card=liste.addressLists.queryElementAt(index, Components.interfaces.nsIAbCard);
      if (card.isMailList)
        continue;
      let email=card.primaryEmail;
      if (null==email && ""==email)
        continue;
      dump("  _getEmailMembres email:"+email+"\n");
      adrs.push(email);
    }
    
    return adrs;
  },
  
  // recherche contact dans this.abook
  _findCardWithEmail:function(email){
    
    let cards=this.abook.childCards;
    while (cards.hasMoreElements()) {
      let card=cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
      if (card.primaryEmail==email)
        return card;
    }
    
    return null;
  },
  
  // recherche instance nsIAbCard de la liste
  getCardForList:function(list){
    
    let param=encodeURIComponent(list.dirName).replace(/[!'()*]/g, function(c) {
                                                return '%' + c.charCodeAt(0).toString(16);
                                              });
    let query=("?(and(IsMailList,=,TRUE)(DisplayName,=,"+param+"))");  

    let cards=MailServices.ab.getDirectory(this.abook.URI+query).childCards;
    while (cards.hasMoreElements()) {
      listCard=cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
    }
    
    return listCard;
  },
  
  // envoie les contacts d'une liste absents sur le serveur
  // correspond au cas ou des membres sont ajoutés sans contact
  // lors de la création/édition d'une liste
  envoieContacts:function(liste){
    
    let nbCards=liste.addressLists.length;
    for (let index=0; index<nbCards; index++) {
      let card=liste.addressLists.queryElementAt(index, Components.interfaces.nsIAbCard);
      if (card.isMailList)
        continue;
      let key=card.getProperty(kNameKey, "");
      dump(" envoieContacts contact key:"+key+"\n");
      if (""==key){
        // nouveau contact créé lors de l'édition de la liste => envoi
        this.uploadContact(card);
      }
    }
  },
  
  // upload d'un contact (nouveau)
  uploadContact:function(card){
    
    let abook=this.abook;
    
    var retourCO={
      
      onDAVQueryComplete: function(status, response, headers, data) {
    
        cm2DavTrace("Envoi d'un contact - reponse du serveur status:"+status);
        if (status > 199 && status < 400) {
          let etag=headers["etag"];
          if (etag && etag.length) {
            
            card.setProperty(kETagKey, ""+String(etag));
            abook.modifyCard(card);        
            cm2DavTrace("envoi d'un contact - nouveau etag serveur:"+etag);
            dump(" envoi d'un contact - nouveau etag serveur:"+etag+"\n");
            
          } else{
            cm2DavTrace("envoi d'un contact - le serveur n'a pas retourne un nouveau etag");
          }
        }
      }    
    }
    
    let vcard=card2vcard(card);
    dump("*** uploadContact vcard: "+vcard+"\n");
    let key=card.getProperty(kNameKey, "");
    if (""==key){
      key=String(new UUID());
      cm2DavTrace("Synchronisation d'un nouveau contact identifiant:"+key);
      card.setProperty(kNameKey, key);       
      this.abook.modifyCard(card);
    }
    
    dump(" uploadContact contact key:"+key+"\n");     
    let data={query: "card-upload", data: card, key: key};
    let cardURL=this.srvurl+key;
    let request=new sogoWebDAV(cardURL, retourCO, data);
    cm2DavTrace("Synchronisation d'une liste - envoi d'un nouveau contact au serveur");
      
    request.put(vcard, "text/vcard; charset=utf-8");
  }
}
