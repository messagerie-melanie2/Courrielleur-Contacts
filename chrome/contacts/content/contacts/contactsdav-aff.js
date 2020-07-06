ChromeUtils.import("resource://gre/modules/Services.jsm");

var carnetsCm2=null;

function affOnLoad(){
 
  if (window.arguments && window.arguments[0].carnets)
    carnetsCm2=window.arguments[0].carnets;
  else
    window.close();
  
  let liste=document.getElementById("affichage-liste");
  let defautid=Services.prefs.getCharPref("courrielleur.contactsdav.defaut");
  
  for (let carnet of carnetsCm2) {
    
    let elem=liste.appendItem(carnet["libelle"], carnet["bookid"]);
    elem.setAttribute("type", "checkbox");
    elem.setAttribute("id", carnet["bookid"]);
    
    if (carnet["affichage"])
      elem.setAttribute("checked", true);
    if (carnet["prefid"]==defautid)
      elem.setAttribute("disabled", true);
  }
}

function affValider(){
  
  let liste=document.getElementById("affichage-liste");
  let bUpdate=false;
  
  for (let carnet of carnetsCm2) {
    
    let elem=document.getElementById(carnet["bookid"]);
    let aff=false;
    
    if (elem.hasAttribute("checked"))
      aff=true;
    if (aff==carnet["affichage"])
      continue;
    
    carnet.affichage=aff;
    bUpdate=true;
  }
  
  window.arguments[0].maj=bUpdate;
  
  Quitter();
}

function Quitter(){
  window.close();
}
