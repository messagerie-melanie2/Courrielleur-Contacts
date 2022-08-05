ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");
ChromeUtils.import("resource:///modules/pacomeUtils.jsm");

var nsIAbDirectoryQueryResultListener=Components.interfaces.nsIAbDirectoryQueryResultListener;

var nsILDAPMessage=Components.interfaces.nsILDAPMessage;


var gDebugMsg=false;
function cm2MajAdrDebug(msg){
  
  if (gDebugMsg)
    Services.console.logStringMessage("*** contacts-majadrcol.js "+msg);
}


var gMajAdrColDlg={
  
  _vumetre: null,
  
  get vumetre(){
    if (!this._silent && 
        null==this._vumetre){
        this._vumetre=document.getElementById("majvu");
    }
    return this._vumetre;
  },
  
  Load: function(){
      
    gDebugMsg=Services.prefs.getBoolPref("courrielleur.majadrcol.debug");
    cm2MajAdrDebug("MajAdrColLoad");
  },
  
  
  // verifie la configuration annuaire
  VerifyConfig: function(){
    
    try{
      
      let prefdir=Services.prefs.getCharPref("ldap_2.autoComplete.directoryServer");
      let pref=prefdir+".uri";
      if (!Services.prefs.prefHasUserValue(pref)){
        this.LogConsole("Erreur de configuration de l'annuaire (préférence absente):"+pref);
        return false;
      }
      
      let uri=Services.prefs.getCharPref(pref);
      if (""==uri){
        this.LogConsole("Erreur de configuration de l'annuaire valeur de la préférence non définie:"+pref);
        return false;
      }
      
      // valider domaine m2
      if (0!=uri.indexOf(M2_LDAP_URL)){
        this.LogConsole("Erreur de configuration de l'annuaire (valeur de la préférence) '"+pref+"' incorrecte:"+uri);
        return false;
      }
      
    } catch(ex){
      this.LogConsole("Erreur de configuration de l'annuaire (exception):"+ex);
      return false;
    }
    
    return true;
  },
  
  // bouton maj
  Execute: function(){
    
    cm2MajAdrDebug("Execute");
  
    if (!this._silent){
      let bt=document.getElementById("btmaj");
      bt.disabled=true;
    }
    
    // verifier annuaire
    let res=this.VerifyConfig();
    if (!res){
      this.alertUser("Erreur dans la configuration d'annuaire (consulter la console)");
      this.Quit();
      return;
    }
    
    // sauvegarde 
    res=this.Backup();
    if (!res){
      this.alertUser("Echec de sauvegarde du carnet (consulter la console)");
      this.Quit();
      return;
    }
    
    // lister domaines smtp
    try{
      
      this.ListeDomainesSmtp();
      
    } catch(ex){
      // log console
      this.LogConsole("Erreur lors de la mise à jour des adresses collectées (exception) :"+ex);
      this.alertUser("Erreur lors de l'accès à l'annuaire (consulter la console)");
      this.Quit();
      return;
    }
  },
  
  // execution en mode silencieux (sans UI)
  _silent:false,
  
  _callback:null,
  
  // callback : fonction de rappel en fin d'opération (sans parametre)
  ExecuteSilent: function(callback){
    
    this._silent=true;
    this._callback=callback;
    
    this.Execute();
  },
  
  Quit: function(){
    cm2MajAdrDebug("Quit");
    
    if (!this._silent)
      window.close();
    
    if (this._callback)
      this._callback();
  },
  
  Backup: function(){
    
    try{
      
      BackupHistoryMab();
      
    } catch(ex){
      cm2MajAdrDebug("MajAdrColStart exception BackupHistoryMab:"+ex);
      return false;
    }
    
    return true;
  },
  
  /* listage des domaines smtp */
  smtpdom: null,
  domaines: null,
  
  ListeDomainesSmtp: function(){
    
    cm2MajAdrDebug("ListeDomainesSmtp");
    this.domaines=[];
    this.smtpdom=new M2SmtpDomaines();
      
    cm2MajAdrDebug("ListeDomainesSmtp smtpdom.ldapurl:"+this.smtpdom.ldapurl);
    if (!this._silent){
      let majmsg=document.getElementById("majmsg");
      majmsg.value=this.getStringFromName("majadrcol_litdom");
    }
  
    this.smtpdom.GetSmtpDomaines(this);
  },
  
  retourSmtpDom: function(code, valeurs){
      
    cm2MajAdrDebug("retourSmtpDom code:"+code);
    
    if (valeurs && 0<=code){
      
      let nb=valeurs.length;
      cm2MajAdrDebug("retourSmtpDom succes listage domaines nombre:"+nb);
      
      let domaines="[";
      for (var i=0;i<nb;i++){
        cm2MajAdrDebug("retourSmtpDom domaine smtp:"+valeurs[i]);
        if (i)
          domaines+=",";
        domaines+='"'+valeurs[i]+'"';
      }
      domaines+="]";
      cm2MajAdrDebug("retourSmtpDom domaines:"+domaines.toString());
      
      this.domaines=valeurs;
      
      // etape suivante => mise à jour des contacts
      try{
        
        this.MajContacts();
        
      } catch(ex){
        // log console
        this.LogConsole("Erreur lors de la mise à jour des adresses collectées (exception) :"+ex);
        this.alertUser("Erreur lors de la mise à jour des adresses (consulter la console)");
        this.Quit();
        return;
      }      
      
    } else{
      this.alertUser("Echec de listage des domaines smtp (consulter la console)");
      this.Quit();
      return;
    }
  },
  
  
  // Mise a jour des contacts
  majAdrCol: null,
  
  //amandeUrl: null,
  
  MajContacts: function(){
    cm2MajAdrDebug("MajContacts");
    
    this.majAdrCol=new Cm2MajAdrCol(this);
  
    this.majAdrCol.SetDomainesSmtp(this.domaines);
  
    this.majAdrCol.MiseAjourContacts();
  },

  // notifications
  Debut: function(){
    
    cm2MajAdrDebug("MajContacts Debut");
    
    if (!this._silent){
      this.vumetre.max=this.majAdrCol._listeAllCards.length;
      let majmsg=document.getElementById("majmsg");
      majmsg.value=this.getStringFromName("majadrcol_libdebut");//"Opération en cours...";
    }
    
    this.LogConsole("Démarrage de la mise à jour des adresses collectées");
  }, 
  
  Fin: function(){
    
    cm2MajAdrDebug("MajContacts Fin");
    
    if (!this._silent){
      let majmsg=document.getElementById("majmsg");
      majmsg.value=this.getStringFromName("majadrcol_libfin");//"Opération terminée";
      this.alertUser("Mise à jour terminée");
    }
    
    this.LogConsole("Fin de la mise à jour des adresses collectées");
    
    this.Quit();
  },
  
  Erreur: function(code, msg){
    
    cm2MajAdrDebug("MajContacts Erreur code:"+code+" - msg:"+msg); 
    
    if (!this._silent){
      let majmsg=document.getElementById("majmsg");
      majmsg.value=this.getStringFromName("majadrcol_liberreur");//"Erreur lors de la mise à jour";
    }
    
    if (null==msg){
      this.LogConsole("Erreur lors de la mise à jour des adresses collectées code erreur:"+code);
      this.alertUser("Erreur lors de la mise à jour des adresses collectées.\n code erreur:"+code);
    } else{
      this.LogConsole("Erreur lors de la mise à jour des adresses collectées code erreur:"+code+" - message:"+msg); 
      this.alertUser("Erreur lors de la mise à jour des adresses collectées.\n  code erreur:"+code+"\n  message:"+msg);
    }
    
    this.Quit();
  }, 
  
  Step: function(n, total){

    if (!this._silent)
      this.vumetre.value=n;
  },
  
  Nofication: function(op, original, nouveau){
    
    if (null==original){
      
      cm2MajAdrDebug("MajContacts Nofication op:"+op);
      this.LogConsole(op);
    } else if (null==nouveau){
      
      cm2MajAdrDebug("MajContacts Nofication op:"+op+" - original:"+original);
      this.LogConsole(op+":"+original);
    } else{
      
      cm2MajAdrDebug("MajContacts Nofication op:"+op+" - original:"+original+" - nouveau:"+nouveau);
      this.LogConsole(op+":"+original+":"+nouveau);
    }
  },
  
  LogConsole: function(msg){
    Services.console.logStringMessage(msg);
  },

  _bundle: null,

  getStringFromName: function(id){

    if (null==this._bundle)
      this._bundle=Services.strings.createBundle("chrome://contacts/locale/contactsdav.properties");

    return this._bundle.GetStringFromName(id);
  },
  
  alertUser: function(message){
    if (!this._silent)
      alert(message);
  }
}


// sauvegarde des adresses collectées avant mise à jour
// nom de fichier avec extension '-n' ou  1<=n<=MAX_BACKUP_MAB
// si n>MAX_BACKUP_MAB => recommence à 1 et supprime suivant
const MAX_BACKUP_MAB=10;
function BackupHistoryMab(){
  
  let dirAdrCol=MailServices.ab.getDirectoryFromId("ldap_2.servers.history");
  let diruser=MailServices.ab.userProfileDirectory;
  cm2MajAdrDebug("BackupHistoryMab diruser:"+diruser.path);
  let nomMab=dirAdrCol.fileName;
  let original=diruser.clone();
  original.append(nomMab);
  
  function delIndex(index){  
    if (MAX_BACKUP_MAB<index)
      return;
    
    let fichier=diruser.clone();
    let nom=nomMab+"-"+index;
    fichier.append(nom);
    
    if (fichier.exists())
      fichier.remove(false);
  }
  
  let i=0;
  while (i++ < MAX_BACKUP_MAB){
    
    let fichier=diruser.clone();
    let nom=nomMab+"-"+i;
    fichier.append(nom);
    
    if (!fichier.exists()){
      
      cm2MajAdrDebug("BackupHistoryMab copie de l'original vers:"+nom);
      original.copyTo(diruser, nom);
      
      // supprimer suivant (cas reprise a 1)
      delIndex(i+1);
      
      return;
    }
  }
  
  cm2MajAdrDebug("BackupHistoryMab quota atteint");
  delIndex(1);
  
  let nom=nomMab+"-1";
  cm2MajAdrDebug("BackupHistoryMab copie de l'original vers:"+nom);
  original.copyTo(diruser, nom);
  
  delIndex(2);
}


/** 
  composant de mise a jour des entrees 
  fonctionnement asynchrone
  
  ecouteur: fonctions Debut, Fin, Erreur(code, msg), Step(n, total), Notification(op, original, nouveau)


-----------------------
Traitement des adresses
-----------------------

- lister adresses
- filtrer adresses dans domaine
si pas dans domaine => ignorer card

si dans domaine:
  si .-. => extraire partage@domaine
  recherche entrée
  si non trouvée:
    si dans domaine gérés et complet => supprimer contact
    si dans domaine racine => effacer le nom
  si trouvée:
    si nouvelle adresse différente:
      rechercher card avec nouvelle adresse
      si existe => supprimer card courante
    sinon mise à jour card avec adresse et cn

*/

// operation de mise a jour
// notifications
const MAJADR_CN="Mis a jour nom complet";
const MAJADR_EFFCN="Effacement nom complet";
const MAJADR_ADR="Mis a jour adresse";
const MAJADR_SUP="Suppression du contact";
const MAJADR_0="Absent dans l'annuaire";
const MAJADR_NO="Non modifié";


function Cm2MajAdrCol(ecouteur){
  
  this._ecouteur=ecouteur;
}

Cm2MajAdrCol.prototype={
  
  _ecouteur:null,
  
  // carnet adresses collectees
  _dirAdrCol:null,
  
  get dirAdrCol(){
    
    if (null==this._dirAdrCol)
      this._dirAdrCol=MailServices.ab.getDirectoryFromId("ldap_2.servers.history");                                   

    return this._dirAdrCol;
  },
    
  // domaines complets
  _domaines:null,
  // domaines 'génériques' (*.test)
  _domracines:null,

  
  // composant de recherche dans l'annuaire
  reqAmde:null,
 
  
  // domainessmtp: tableau de domaines smtp
  SetDomainesSmtp: function(domainessmtp){
    
    this._domaines=[];
    this._domracines=[];
    if (null==domainessmtp)
      return;
    
    for (var dom of domainessmtp){
      if ('*'==dom.charAt(0))
        this._domracines.push(dom.substr(1));
      else
        this._domaines.push(dom);
    }
  }, 
  
  // contacts a traiter
  _listeAllCards:null,  
  // index en cours de traitement
  _indexCard:0,
  
  
  // méthode principale de mise à jour
  // fonctionnement asynchrone
  MiseAjourContacts: function(){
          
    // liste des adresses du carnet
    let res=this.ListeCards();
    if (-1==res){
      this.Erreur(-1, "Erreur de listage des contacts");
      return;
    }
    
    if (null==this._listeAllCards ||
        0==this._listeAllCards.length){
      // aucun contact
      this.Fin();
      return;      
    }
    
    // initialiser la connexion a l'annuaire
    this.reqAmde=new M2QueryAmande(this);
    
    this.reqAmde.InitConnection();
    
    // suite traitee dans onInit

  },
  
  // traitement d'un contact (asynchrone)
  TraiteContact: function(index){

    if (null==this._listeAllCards ||
        index >= this._listeAllCards.length){
      cm2MajAdrDebug("Cm2MajAdrCol TraiteContact erreur d'index");
      return;
    }
    
    let card=this._listeAllCards[index];
    cm2MajAdrDebug("Cm2MajAdrCol TraiteContact primaryEmail:"+card.primaryEmail);
    
    // recherche dans l'annuaire (asynchrone)
    this.ChercheEntree(card.primaryEmail);
    
  },
  
  // contact suivant
  TraiteSuivant: function(){
    
    let nb=this._listeAllCards.length;
    this.Step(this._indexCard+1, nb);
    
    if (null==this._listeAllCards ||
        this._indexCard+1 >= nb){
      // plus de contact
      cm2MajAdrDebug("Cm2MajAdrCol TraiteSuivant plus de contact");
      this.Fin();
      return;
    }
    
    this._indexCard++;
    this.TraiteContact(this._indexCard);   
  },
  
  ChercheEntree: function(mail){
    
    let adr=mail;
    
    // cas prenom.nom.-.partage@test
    // chercher sur partage@test
    const compos=SplitUserBalp(mail);
    if (compos && 2==compos.length){
      adr=compos[1];
      cm2MajAdrDebug("Cm2MajAdrCol ChercheEntree boite partagee:"+mail);
    }
    
    cm2MajAdrDebug("Cm2MajAdrCol ChercheEntree:"+adr);
    this.reqAmde.ChercheEntree(adr);
  },
  
  // retour recherche (cas entre trouvee)
  // si code 0 => entree trouvee : cnmsg => cn, mail
  // si code -1 => entree non trouvee : cnmsg et mail => null
  // sinon code erreur : cnmsg => message erreur (facultatif peut etre a null)
  onRechercheFin: function(code, cnmsg, mail){
    
    if (0==code){
      // si code 0 => entree trouvee : cnmsg => cn, mail
      cm2MajAdrDebug("Cm2MajAdrCol onRechercheFin cn:"+cnmsg+" - mail:"+mail);
      
      // mise a jour du contact
      let card=this._listeAllCards[this._indexCard];
      this.majContact(card, cnmsg, mail);
      
    } else if (-1==code){
      // si code -1 => entree non trouvee : cnmsg et mail => null
      cm2MajAdrDebug("Cm2MajAdrCol onRechercheFin pas d'entree");
      
      // mise a jour du contact
      let card=this._listeAllCards[this._indexCard];
      this.majContact(card, null, null);
      
    } else {
      
      //sinon code erreur : cnmsg => message erreur (facultatif peut etre a null)
      cm2MajAdrDebug("Cm2MajAdrCol onRechercheFin erreur code:"+code+" - message:"+cnmsg);
      
      // stop
      this.Erreur(code, cnmsg);

      return;
    }

    // contact suivant
    this.TraiteSuivant();
  },
  
  onInit: function(code, message){
    
    if (0==code){
      
      // traiter la premiere entree (asynchrone)
      this._indexCard=0;
      this.Debut();

      this.TraiteContact(this._indexCard);
      
    } else    
      this.Erreur(code, message);   
  },
  
  // méthode de mise à jour d'un contact après recherche
  // card: le contact du carnet (original)
  // cn : nom complet dans l'annuaire
  // mail: adresse dans l'annuaire (ldap_2.servers.Amde.attrmap.PrimaryEmail =>	mailPR)
  // si cn et mail null => entree non trouvee
  majContact: function(card, cn, mail){
    
    cm2MajAdrDebug("Cm2MajAdrCol majContact mail:"+mail);
    
    if (null==mail){
      // si non trouvée:
      let oldmail=card.primaryEmail;
      let pos=oldmail.indexOf("@");
      let domadr=oldmail.substr(pos+1);
      
      this.Notification(MAJADR_0, oldmail);
      
      if (null!=this._domaines &&
          this._domaines.includes(domadr)){
        // si dans domaine gérés et complet => supprimer contact
        this.Notification(MAJADR_SUP, oldmail);
        this.deleteCard(card);
        
      }
      
    } else {
      // entree existe dans l'annuaire
      
      let oldcn=card.displayName;
      let oldmail=card.primaryEmail;
      
      if (oldmail!=mail){
        //cm2MajAdrDebug("Cm2MajAdrCol majContact nouvelle adresse différente");
        // si nouvelle adresse différente:
        // rechercher card avec nouvelle adresse        
        let index=this._listeAllCards.findIndex(function (element, index, array){
                                                let adr=element.primaryEmail;
                                                if (adr && adr==mail)
                                                  return true;
                                                return false;
                                                });
        if (-1!=index){
          // si existe => supprimer card courante
          this.Notification(MAJADR_SUP, oldmail);
          this.deleteCard(card);
          
        } else{
          // sinon mise à jour card avec adresse et/ou cn
          if (oldcn!=cn){
            card.displayName=cn;
            card.firstName="";
            card.lastName="";
            this.Notification(MAJADR_ADR, oldmail, mail);
            this.Notification(MAJADR_CN, oldcn, cn);
            
          } else
            this.Notification(MAJADR_ADR, oldmail, mail);

          card.primaryEmail=mail;
          this.dirAdrCol.modifyCard(card);
        }
        
      } else{
        
        // sinon mise à jour card avec cn?
        if (oldcn!=cn){
          card.displayName=cn;
          card.firstName="";
          card.lastName="";
          this.Notification(MAJADR_CN, oldcn, cn);
          this.dirAdrCol.modifyCard(card);
        }
      }      
    }
  },
  
  // suppression d'un contact
  deleteCard: function(card){
    
    let cardArray=Components.classes["@mozilla.org/array;1"]
                            .createInstance(Components.interfaces.nsIMutableArray);
    cardArray.appendElement(card, false);

    this.dirAdrCol.deleteCards(cardArray);
  },
  
  
  // listage des contects a traiter
  // retourn nombre ou -1 si erreur
  ListeCards: function (){
    
    let dircol=this.dirAdrCol;
    if (null==dircol){
      cm2MajAdrDebug("Cm2MajAdrCol ListeCards null==dircol");
      return -1;
    }
    
    // liste des adresses du carnet
    this._listeAllCards=new Array();
    let cards=dircol.childCards;
    while (cards.hasMoreElements()) {
      let card=cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
      let adr=card.primaryEmail;
      if (""!=adr){
        cm2MajAdrDebug("Cm2MajAdrCol ListeCards adresse:"+adr);
        // ne lister que les adresses dans les domaines
        if (this.AdrDansDomaine(adr))
          this._listeAllCards.push(card);
        else
          cm2MajAdrDebug("Cm2MajAdrCol ListeCards pas dans un domaine gere");
      }
    }
    
    return this._listeAllCards.length;
  },
  
  // teste si une adresses est dans les domaines
  // true si ok
  AdrDansDomaine: function(adr){
    
    let pos=adr.indexOf("@");
    if (-1==pos){
      cm2MajAdrDebug("Cm2MajAdrCol AdrDansDomaine pas de @ !!!");
      return false;
    }
    
    let domadr=adr.substr(pos+1);
    
    if (null!=this._domaines &&
        this._domaines.includes(domadr))
      return true; 
    
    function testDom(elem, index, array){
      return domadr.endsWith(elem);
    }
    
    if (null!=this._domracines)
      return this._domracines.some(testDom);
    
    return false;
  },
  
  // fonctions pour l'ecouteur
  Debut: function(){

    if (this._ecouteur &&
        this._ecouteur.Debut){
      this._ecouteur.Debut();    
    }
  },
  
  Fin: function(){

    if (this._ecouteur &&
        this._ecouteur.Fin){
      this._ecouteur.Fin();    
    }
  },
  
  Erreur: function(code, msg){

    if (this._ecouteur &&
        this._ecouteur.Erreur)
      this._ecouteur.Erreur(code, msg);    
  },
  
  Step: function(n, total){

    if (this._ecouteur &&
        this._ecouteur.Step){
      this._ecouteur.Step(n, total);    
    }
  },
  
  Notification: function(op, original, nouveau){

    if (this._ecouteur &&
        this._ecouteur.Nofication)
      this._ecouteur.Nofication(op, original, nouveau);    
  }
}




/** 
  lecteur configuration domaines smtp 
  fonctionnement asynchrone
*/
// limite de temps ldap (s)
const MAJADRCOL_TIMEOUT=30;
// url de l'annuaire de recherche
const M2_LDAP_URL="ldap://ldap.m2.e2.rie.gouv.fr/";
// base de recherche des domaines smtp
const M2_LDAP_DOMBASE="ou=mineqDomainesSMTP,ou=nomenclatures,ou=ressources,dc=equipement,dc=gouv,dc=fr";
// filtre de recherche des domaines smtp
const M2_LDAP_DOMFILTRE="(objectClass=mineqNomenclature)";

function M2SmtpDomaines(){
  
}

M2SmtpDomaines.prototype={
    
  // _ecouteur.retourSmtpDom
  _ecouteur:null,
  
  _ldapserveururl:null,
  
  _ldapconn:null,
  
  InitLdapConnexion: function(){
     
    if (null==this.ldapurl){
      cm2MajAdrDebug("M2SmtpDomaines InitLdapConnexion ldapurl non definie!");
      return null;
    }
    cm2MajAdrDebug("M2SmtpDomaines InitLdapConnexion ldapurl:"+this.ldapurl);
    
    this._ldapserveururl=Services.io.newURI(this.ldapurl, null, null)
                              .QueryInterface(Components.interfaces.nsILDAPURL);
    this._ldapserveururl.init(Components.interfaces.nsIStandardURL.URLTYPE_STANDARD,
                              389, this.ldapurl, "UTF-8", null);

    // this._ldapserveururl.addAttribute("mineqrdn");
    // mineqDomainesSMTP
    this._ldapserveururl.addAttribute("mineqDomainesSMTP");
    this._ldapserveururl.scope=Components.interfaces.nsILDAPURL.SCOPE_ONELEVEL;
    this._ldapserveururl.filter=M2_LDAP_DOMFILTRE;

    this._ldapconn=Components.classes["@mozilla.org/network/ldap-connection;1"]
                             .createInstance().QueryInterface(Components.interfaces.nsILDAPConnection);

    this._ldapconn.init(this._ldapserveururl, null, this, null, Components.interfaces.nsILDAPConnection.VERSION3); 
  },
  
  GetLdapOperation: function(){
              
    if (null==this._ldapconn){
      cm2MajAdrDebug("M2SmtpDomaines ldapConnexion non definie!");
      return null;
    }
    
    let ldapOper=Components.classes["@mozilla.org/network/ldap-operation;1"].createInstance()
                             .QueryInterface(Components.interfaces.nsILDAPOperation);
    //cm2MajAdrDebug("M2SmtpDomaines GetLdapOperation init");
    try{
      
      ldapOper.init(this._ldapconn, this, null);

    } catch(ex){
      cm2MajAdrDebug("M2SmtpDomaines GetLdapOperation init exception:"+ex);
      return null;
    }
 
    return ldapOper;
  },
  
  _ldapurl:null,
  
  get ldapurl(){
    
    if (null==this._ldapurl){
      let prefdir=Services.prefs.getCharPref("ldap_2.autoComplete.directoryServer");
      let pref=prefdir+".uri";
      let uri=Services.prefs.getCharPref(pref);
      if (uri && ""!=uri){
        let pos=uri.indexOf("?");
        if (-1!=pos){
          this._ldapurl=uri.substr(0,pos);
        } else{
          this._ldapurl=uri;
        }
      }
      if (null==this._ldapurl)
        this._ldapurl=M2_LDAP_URL;
      this._ldapurl+=M2_LDAP_DOMBASE;
    }
    
    if (null==this._ldapurl){
      return M2_LDAP_URL;
    }
    
    return this._ldapurl;
  },
  
  // lecture des domaines smtp
  // ecouteur.retourSmtpDom fonction de retour des résultats (asynchrone)
  // rappel(code, result)
  //  retourne un tableau de noms de domaines (result)
  //  code: 0 si succes, -1 ou code erreur si erreur
  GetSmtpDomaines: function(ecouteur){
    
    // ldap url
    let url=this.ldapurl;
    if (null==url || ""==url){
      cm2MajAdrDebug("M2SmtpDomaines GetSmtpDomaines url ldap non definie!");
      if (ecouteur)
        ecouteur.retourSmtpDom(-1,null);
      return -1;
    }
    
    this._ecouteur=ecouteur;
    
    // ldap connection
    this.InitLdapConnexion();
    
    // operation suivante gerees depuis onLDAPInit 
  },
  
  ListDomaines: function(ldapoper){
    
    this._results=[];
    
    ldapoper.searchExt(this._ldapserveururl.dn, this._ldapserveururl.scope, this._ldapserveururl.filter,
                       this._ldapserveururl.attributes, MAJADRCOL_TIMEOUT, 100);
  },
  
  _results:null,
  
  AjoutEntree: function(valeur){
    
    this._results.push(valeur);
  },
  
  onLDAPMessage: function(aMessage) {
      
    if (0!=aMessage.errorCode){
      
      if (this._ecouteur){
        this._ecouteur.retourSmtpDom(aMessage.errorCod, null);
      }
      return;
    }
    if (nsILDAPMessage.RES_SEARCH_ENTRY==aMessage.type){
          
      let nb={};
      let vals=aMessage.getValues("mineqDomainesSMTP", nb);      
      cm2MajAdrDebug("M2SmtpDomaines onLDAPMessage entree valeurs:"+vals);
      if (1==nb.value)
        this.AjoutEntree(vals[0]);
      return;
    }
    
    if (nsILDAPMessage.RES_SEARCH_RESULT==aMessage.type){
      cm2MajAdrDebug("M2SmtpDomaines onLDAPMessage recherche terminee");
      if (this._ecouteur){
        this._ecouteur.retourSmtpDom(0, this._results);
      }
      return;
    }
  },

  onLDAPInit: function(aConn, aStatus) {
    // InitLdapConnexion terminee
    if (0!=aStatus){
      cm2MajAdrDebug("M2SmtpDomaines onLDAPInit aConn.errorString:"+aConn.errorString);
      if (this._ecouteur){
        this._ecouteur.retourSmtpDom(aStatus, aConn.errorString);
      }
      return;
    }
    
    let ldapoper=this.GetLdapOperation();
    if (null==ldapoper){
      cm2MajAdrDebug("M2SmtpDomaines onLDAPInit echec GetLdapOperation!");
      return;
    }
    
    this.ListDomaines(ldapoper);
  }
}



/*
  classe de recherche dans l'annuaire Amande du courrielleur
  basee sur l'instance amande du courrielleur
  ecouteur : fonction onRechercheFin(code, cnmsg, mail)
*/
function cm2RechercheAmde(ecouteur){
  
  this._ecouteur=ecouteur;
}

cm2RechercheAmde.prototype={
  
  _ecouteur:null,
  
  // entree trouvee
  ldapCard:null,
  
  // annuaire ldap
  _dirLdap:null,
  
  get dirLdap(){
    
    if (null==this._dirLdap){
      let prefdir=Services.prefs.getCharPref("ldap_2.autoComplete.directoryServer");
      let dirURI="moz-abldapdirectory://"+prefdir;
      this._dirLdap=MailServices.ab.getDirectory(dirURI)
                                   .QueryInterface(Components.interfaces.nsIAbLDAPDirectory);                                   
    }
    return this._dirLdap;
  },
  
  _ldapService:null,
  
  get ldapService(){
    if (null==this._ldapService){
      this._ldapService=Components.classes["@mozilla.org/network/ldap-service;1"]
                                  .getService(Components.interfaces.nsILDAPService);;
    }
    return this._ldapService;
  },
  
  // 
  _ldapQuery:null,
  
  get ldapQuery(){
    
    if (null==this._ldapQuery){
      this._ldapQuery=Components.classes["@mozilla.org/addressbook/ldap-directory-query;1"]
                                .createInstance(Components.interfaces.nsIAbDirectoryQuery);
    }
    
    return this._ldapQuery;
  },
  
  // attributs recherches
  _attributsRech:null,
  
  get attributsRech(){
    
    if (null==this._attributsRech){
      this._attributsRech=Components.classes["@mozilla.org/addressbook/ldap-attribute-map;1"]
                                    .createInstance(Components.interfaces.nsIAbLDAPAttributeMap);
      this._attributsRech.setAttributeList("DisplayName",
                                           this.dirLdap.attributeMap.getAttributeList("DisplayName", {}), true);
      this._attributsRech.setAttributeList("PrimaryEmail",
                                           this.dirLdap.attributeMap.getAttributeList("PrimaryEmail", {}), true);
    }
    
    return this._attributsRech;
  },
  
  
  // recherche une entree dans l'annuaire
  ChercheEntree: function(adrmail){
    cm2MajAdrDebug("cm2RechercheAmde ChercheEntree adrmail:"+adrmail);
    this.ldapCard=null;
    
    let filtre=this.CreeFiltreRech(adrmail);
    if (null==filtre || ""==filtre){
      cm2MajAdrDebug("cm2RechercheAmde ChercheEntree erreur de filtre");
      return;
    }
    //cm2MajAdrDebug("cm2RechercheAmde ChercheEntree filtre:"+filtre);  
    
    let args=Components.classes["@mozilla.org/addressbook/directory/query-arguments;1"]
                       .createInstance(Components.interfaces.nsIAbDirectoryQueryArguments);
    
    args.typeSpecificArg=this.attributsRech;
    args.querySubDirectories=true;
    args.filter=filtre;
    
    //cm2MajAdrDebug("cm2RechercheAmde ChercheEntree doQuery");
    try {
      
      this.ldapQuery.doQuery(this.dirLdap, args, this, 1, MAJADRCOL_TIMEOUT);
      
    } catch(ex){
      // exception si offline etc...
      if (this._ecouteur && 
          this._ecouteur.onRechercheFin){            
        this._ecouteur.onRechercheFin(-1, "Exception lors d'une recherche dans l'annuaire");    
      }
    }
  },
  
  // cree le filtre de recherche d'une entree
  CreeFiltreRech: function(adrmail){
    
    let filtre=this.ldapService.createFilter(1024, "(mail=%v1)", "", "", "", adrmail);
    //var filtre=this.ldapService.createFilter(1024, "(&(mineqPortee>=00)(mail=%v1))", "", "", "", adrmail);
    return filtre;
  },
  
  // nsIAbDirSearchListener
  onSearchFinished: function(aResult, aErrorMsg){
    cm2MajAdrDebug("cm2RechercheAmde onSearchFinished");
    
    if (aResult==nsIAbDirectoryQueryResultListener.queryResultComplete) {
      //cm2MajAdrDebug("cm2RechercheAmde onSearchFinished queryResultComplete");
      
      if (this._ecouteur && 
          this._ecouteur.onRechercheFin){
        
        if (this.ldapCard)
          this._ecouteur.onRechercheFin(0, this.ldapCard.displayName, this.ldapCard.primaryEmail);    
        else // entree non trouvee
          this._ecouteur.onRechercheFin(-1, null, null);  
      }
      return;
    }
    else if (aResult==nsIAbDirectoryQueryResultListener.queryResultError) {
      //cm2MajAdrDebug("cm2RechercheAmde onSearchFinished queryResultError aErrorMsg:"+aErrorMsg);     
      if (!aErrorMsg || ""==aErrorMsg){
        aErrorMsg="Erreur d'accès à l'annuaire";
      }
    }
    
    if (this._ecouteur && 
        this._ecouteur.onRechercheFin){
      this._ecouteur.onRechercheFin(aResult, aErrorMsg);    
    }
  },

  onSearchFoundCard: function(aCard){
    //cm2MajAdrDebug("cm2RechercheAmde onSearchFoundCard aCard.displayName:"+aCard.displayName);
    //cm2MajAdrDebug("cm2RechercheAmde onSearchFoundCard aCard.primaryEmail:"+aCard.primaryEmail);
    this.ldapCard=aCard;
  }
}


/* requetes ldap amande */
// filtre de recherche par defaut (cas non configure)
const M2_LDAP_FILTRE_BAL="(|(objectclass=mineqMelDP)(objectclass=mineqMelBoite)(objectclass=mineqMelListe)(objectclass=mineqMelListeAbonnement))";

function M2QueryAmande(ecouteur){
  
  this._ecouteur=ecouteur;
}

M2QueryAmande.prototype={
    
  // _ecouteur.onRechercheFin(code, cnmsg, mail)
   // si code 0 => entree trouvee : cnmsg => cn, mail
  // si code -1 => entree non trouvee : cnmsg et mail => null
  // sinon code erreur : cnmsg => message erreur (facultatif peut etre a null)
  //
  // _ecouteur.onInit(code, message)
  // 0 si ok, sinon code erreur et message
  _ecouteur:null,
  
  _ldapserveururl:null,
  
  _ldapconn:null,
  
  InitConnection: function(){
    
    if (null==this._ldapconn){
      
      let prefdir=Services.prefs.getCharPref("ldap_2.autoComplete.directoryServer");
      let pref=prefdir+".uri";
      let uri=Services.prefs.getCharPref(pref);
      let urlamde;
      let filtre;
      if (uri && ""!=uri){
        let elems=uri.split("?");
        if (2<=elems.length){
          urlamde=elems[0];
          filtre=elems[elems.length-1];
          let re=/mineqPortee%3E=[0-9]{1,2}/;
          filtre=filtre.replace(re, "mineqPortee%3E=00");
        }
        if (null==filtre || ""==filtre){
          filtre=M2_LDAP_FILTRE_BAL;         
        }
      }
      
      this._ldapserveururl=Services.io.newURI(urlamde, null, null)
                                .QueryInterface(Components.interfaces.nsILDAPURL);
      this._ldapserveururl.init(Components.interfaces.nsIStandardURL.URLTYPE_STANDARD,
                                389, urlamde, "UTF-8", null);

      this._ldapserveururl.attributes=this.attributsRech;
      this._ldapserveururl.scope=Components.interfaces.nsILDAPURL.SCOPE_SUBTREE;
      this._ldapserveururl.filter=filtre;

      this._ldapconn=Components.classes["@mozilla.org/network/ldap-connection;1"]
                               .createInstance().QueryInterface(Components.interfaces.nsILDAPConnection);

      this._ldapconn.init(this._ldapserveururl, null, this, null, Components.interfaces.nsILDAPConnection.VERSION3);
            
    } else {
      
      if (null!=this._ecouteur)
        this._ecouteur.onInit(0,"");
    }
  },
  
  GetLdapOperation: function(){
         
    if (null==this._ldapconn){
      cm2MajAdrDebug("M2QueryAmande ldapConnexion non definie!");
      return null;
    }
      
    let ldapOp=Components.classes["@mozilla.org/network/ldap-operation;1"].createInstance()
                         .QueryInterface(Components.interfaces.nsILDAPOperation);
    //cm2MajAdrDebug("M2QueryAmande GetLdapOperation init");
    try{
      
      ldapOp.init(this._ldapconn, this, null);

    } catch(ex){
      cm2MajAdrDebug("M2QueryAmande GetLdapOperation init exception:"+ex);
      return null;
    }

    return ldapOp;
  },
    
  get attributsRech(){
    
    return "cn,mailPR";
  },
  
  // recherche une entree dans l'annuaire
  ChercheEntree: function(adrmail){
    
    this._results=[];
    
    if (null==adrmail ||
        ""==adrmail){         
      this.onRechercheFin(-1, "Parametre de recherche incorrect");
      return;
    }
    
    let ldapOp=this.GetLdapOperation();
    
    if (null==ldapOp){
      this._ecouteur.onRechercheFin(-1, "Echec de la recherche");
      return;
    }
    
    let filtre="(mail="+adrmail+")";
    
    ldapOp.searchExt(this._ldapserveururl.dn, 
                      this._ldapserveururl.scope, 
                      filtre,
                      this._ldapserveururl.attributes, MAJADRCOL_TIMEOUT, 100);
  },
  
  _results:null,
  
  AjoutEntree: function(cn, mailpr){
    
    this._results.push({"cn":cn,"mailpr":mailpr});
  },
  
  onLDAPMessage: function(aMessage) {
      
    if (0!=aMessage.errorCode){
      
      if (this._ecouteur){
        this._ecouteur.onRechercheFin(aMessage.errorCod, null);
      }
    }
    else if (nsILDAPMessage.RES_SEARCH_ENTRY==aMessage.type){
          
      let nb={};
      let cn=aMessage.getValues("cn", nb);      
      let mailpr=aMessage.getValues("mailPR", nb);    

      if (1==nb.value)
        this.AjoutEntree(cn, mailpr);     
    }
    else if (nsILDAPMessage.RES_SEARCH_RESULT==aMessage.type){
      cm2MajAdrDebug("M2QueryAmande onLDAPMessage recherche terminee");
      if (this._ecouteur){
        if (1==this._results.length)
          this._ecouteur.onRechercheFin(0, this._results[0].cn, this._results[0].mailpr);
        else 
          this._ecouteur.onRechercheFin(-1, "Aucune entree dans l'annuaire");
      }
    }
  },

  onLDAPInit: function(aConn, aStatus) {
    
    if (0!=aStatus)
      cm2MajAdrDebug("M2QueryAmande onLDAPInit aConn.errorString:"+aConn.errorString);
    else
      cm2MajAdrDebug("M2QueryAmande onLDAPInit aStatus 0");
    
    if (null==this._ecouteur)
      return;
    
    // InitLdapConnexion terminee
    if (0!=aStatus){
      this._ecouteur.onInit(aStatus, aConn.errorString);
    } else {
      this._ecouteur.onInit(0, "");
    }
  }
}


/* fonctions de test */

function Test_M2QueryAmande(){
  
  try{
    
    let test_step=0;
    
    var ecouteur={
      onInit: function(code, message){
        
        if (message)
          cm2MajAdrDebug("Test_M2QueryAmande onInit code:"+code+" - message:"+message);
        else
          cm2MajAdrDebug("Test_M2QueryAmande onInit code:"+code);
        
        if (0==code){
          test_step++;
          query.ChercheEntree("test.chgtserveur@developpement-durable.gouv.fr");
          
        }
      },
      
      onRechercheFin: function(code, cn, mail){
        cm2MajAdrDebug("Test_M2QueryAmande onRechercheFin code:"+code);
        if (0==code){
          cm2MajAdrDebug("Test_M2QueryAmande onRechercheFin cn:"+cn);
          cm2MajAdrDebug("Test_M2QueryAmande onRechercheFin mail:"+mail);
          test_step++;
          // 2eme recherche
          if (2==test_step){
            query.ChercheEntree("marissa.mayer@i-carre.net");
          } else if (3==test_step){
            // pas dans annuaire
            query.ChercheEntree("vseerror@lehigh.edu");
          } else if (4==test_step){
            // portee 00
            query.ChercheEntree("identifiant.un@LaBoiteNePeutPasEmettre");
          }
            
          
        } else{
          cm2MajAdrDebug("Test_M2QueryAmande onRechercheFin message:"+cn);
        }       
      }     
    }
    
    let query=new M2QueryAmande(ecouteur);
    
    let attrs=query.attributsRech;
    cm2MajAdrDebug("Test_M2QueryAmande attributsRech:"+attrs);
    
    query.InitConnection();
    
  } catch(ex){
    cm2MajAdrDebug("Test_M2QueryAmande exception:"+ex);
  }
}


function Test_MajAdrCol(){
  
  cm2MajAdrDebug("Test_MajAdrCol"); 
  
  var ecouteur={
    
    Debut: function(){
      cm2MajAdrDebug("Test_MajAdrCol Debut");
    }, 
    Fin: function(){
      cm2MajAdrDebug("Test_MajAdrCol Fin");
    }, 
    Erreur: function(code, msg){
      cm2MajAdrDebug("Test_MajAdrCol Erreur code:"+code+" - msg:"+msg); 
    }, 
    Step: function(n, total){
      cm2MajAdrDebug("Test_MajAdrCol Step n:"+n+" - total:"+total);
    },
    Nofication: function(op, original, nouveau){
      cm2MajAdrDebug("Test_MajAdrCol Nofication op:"+op+" - original:"+original+" - nouveau:"+nouveau);
    }
  }
  
  let majAdrCol=new Cm2MajAdrCol(ecouteur);
  
  let domaines=["*.i2","vnf.fr","*.gouv.fr","cerema.fr","*mrccfr.eu","*mrscfr.eu","i-carre.net","anah.gouv.fr","cnphl.gouv.fr","cop21.gouv.fr","debatpublic.fr","scn.rie.gouv.fr","fnap-logement.fr","logement.gouv.fr","tourisme.gouv.fr","territoires.gouv.fr","accessibilite.gouv.fr","info-routiere.gouv.fr","cidol.logement.gouv.fr","didol.logement.gouv.fr","*LaBoiteNePeutPasEmettre","developpement-durable.gouv.fr","logement-ville.gouv.fr","equipement-agriculture.gouv.fr","transition-energetique.gouv.fr","hautconseildesbiotechnologies.fr"];
  majAdrCol.SetDomainesSmtp(domaines);
  
  majAdrCol.MiseAjourContacts();  
}


function Test_Domaines(){
  
  cm2MajAdrDebug("Test_Domaines");
  
  let smtpdom=new M2SmtpDomaines();
  
  var ecouteur={
     retourSmtpDom: function(code, valeurs){
      
      cm2MajAdrDebug("Test_Domaines retourSmtpDom code:"+code);
      
      if (valeurs && 0<=code){
        let nb=valeurs.length;
        cm2MajAdrDebug("Test_Domaines succes listage domaines nombre:"+nb);
        
        let domaines="[";
        for (var i=0;i<nb;i++){
          cm2MajAdrDebug("Test_Domaines domaine smtp:"+valeurs[i]);
          if (i)
            domaines+=",";
          domaines+='"'+valeurs[i]+'"';
        }
        domaines+="]";
        cm2MajAdrDebug("Test_Domaines domaines:"+domaines.toString());
      }
    }
  }
  
  cm2MajAdrDebug("Test_Domaines smtpdom.ldapurl:"+smtpdom.ldapurl);
  
  smtpdom.GetSmtpDomaines(ecouteur);
}
