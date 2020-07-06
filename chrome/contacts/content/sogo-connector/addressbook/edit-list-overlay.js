/* edit-list-overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
 *
 * Copyright: Inverse inc., 2006-2010
 *    Author: Robert Bolduc, Wolfgang Sourdeau
 *     Email: support@inverse.ca
 *       URL: http://inverse.ca
 *
 * "SOGo Connector" is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 as published by
 * the Free Software Foundation;
 *
 * "SOGo Connector" is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * "SOGo Connector"; if not, write to the Free Software Foundation, Inc., 51
 * Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("abNewCardDialog.groupdav.overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://sogo-connector/content/addressbook/folder-handling.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
           "chrome://contacts/content/contactsdav-utils.js"]);

let autocompleteWidgetPrefix = "addressCol1";

var gListeOriginale=null;

function OnLoadEditListOverlay() {
    this.SCOldMailListOKButton = this.MailListOKButton;
    this.MailListOKButton = this.SCMailListOKButton;
    this.SCOldEditListOKButton = this.EditListOKButton;
    this.EditListOKButton = this.SCEditListOKButton;

    // 	if (window.arguments && window.arguments[0]) {
    // 		let card = window.arguments[0].abCard;
    // 		dump("card: " + card + "\n");
    // 		let list = card.QueryInterface(Components.interfaces.nsIAbDirectory);
    // 		dump("list: " + list + "\n");
    // 	}
    
  // mantis 4392
  RegisterSaveListener(cm2SaveMailList);
  
  if ("arguments" in window && window.arguments[0]){
    var listUri=window.arguments[0].listURI;
    var liste=GetDirectoryFromURI(listUri);
    if (liste){
      gListeOriginale=Components.classes["@mozilla.org/addressbook/directoryproperty;1"]
                                .createInstance(Components.interfaces.nsIAbDirectory);
      gListeOriginale.dirName=liste.dirName;
      gListeOriginale.listNickName=liste.listNickName;
      gListeOriginale.description=liste.description;
      let nbCards=liste.addressLists.length;
      for (let index=0; index<nbCards; index++) {
        let card=liste.addressLists.queryElementAt(index, Components.interfaces.nsIAbCard);
        gListeOriginale.addressLists.appendElement(card, false);
      }
    }
  }
  
  // fin mantis 4392
}


var gListeModif=null;
function cm2SaveMailList(liste, document){
  //dump("*** cm2SaveMailList\n");

  gListeModif=liste;

  UnregisterSaveListener(cm2SaveMailList);
}

function SCMailListOKButton() {
    let rc = this.SCOldMailListOKButton();
    if (rc) {
        let popup = document.getElementById('abPopup');
        let uri = popup.getAttribute('value');
        if (isGroupdavDirectory(uri))
            //window.opener.SCSynchronizeFromChildWindow(uri);
          window.opener.cm2SynchroListeFromChildWindow(gListeModif);
    }

    return rc;
}

function SCEditListOKButton() {
    let rc = this.SCOldEditListOKButton();

    if (rc) {
        let listURI = window.arguments[0].listURI;
        let parentURI = GetParentDirectoryFromMailingListURI(listURI);

        if (isGroupdavDirectory(parentURI)) {
            let w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                              .getService(Components.interfaces.nsIWindowMediator)
                              .getMostRecentWindow("mail:addressbook");

            if (!w) {
                w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                              .getService(Components.interfaces.nsIWindowMediator)
                              .getMostRecentWindow("mail:3pane");
            }

            let newList=GetDirectoryFromURI(listURI);
            let attributes = new GroupDAVListAttributes(listURI);
            attributes.versionprev=attributes.version;
            attributes.version=-1;
                  
            w.cm2SynchroListeFromChildWindow(newList, gListeOriginale);
            
            //w.SCSynchronizeFromChildWindow(parentURI);
        }
    }

    return rc;
}

window.addEventListener("load", OnLoadEditListOverlay, false);
