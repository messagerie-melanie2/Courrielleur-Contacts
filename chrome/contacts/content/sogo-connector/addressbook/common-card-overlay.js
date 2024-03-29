/* -*- Mode: js2-mode; tab-width: 4; c-tab-always-indent: t; indent-tabs-mode: nil; c-basic-offset: 4 -*- */

function jsInclude(files, target) {
    let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
    for (let i = 0; i < files.length; i++) {
        try {
            loader.loadSubScript(files[i], target);
        }
        catch(e) {
            dump("common-card-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
        }
    }
}

jsInclude(["chrome://sogo-connector/content/addressbook/categories.js",
           "chrome://sogo-connector/content/general/sync.addressbook.groupdav.js",
           "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js"]);

let gSCCardValues = {
    documentDirty: false,
    categories: [],

    // This is necessary to allow the listener of webdavPutString and the
    // upload Observer to remain in scope since the dialog is closed before
    // the listener can do its job.

    messengerWindow: Components.classes["@mozilla.org/appshell/window-mediator;1"]
                               .getService(Components.interfaces.nsIWindowMediator)
                               .getMostRecentWindow("mail:3pane"),
    abWindow: Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Components.interfaces.nsIWindowMediator)
                        .getMostRecentWindow("mail:addressbook")
};

function SCOnCommonCardOverlayLoad() {
    if (typeof(SCOnCommonCardOverlayLoadPreHook) == "function") {
        SCOnCommonCardOverlayLoadPreHook();
    }
    /* categories */
    /* migration from MoreFunctionsblabla */
    let cardCategoriesValue = gEditCard.card.getProperty("Category", "");
    if (cardCategoriesValue.length > 0) {
        let migrationValue = cardCategoriesValue.split(", ").join("\u001A");
        gEditCard.card.setProperty("Categories", migrationValue);
        gEditCard.card.setProperty("Category", "");
    }

    cardCategoriesValue = gEditCard.card.getProperty("Categories", "");
    let catsArray = multiValueToArray(cardCategoriesValue);
    gSCCardValues.categories = SCContactCategories.getCategoriesAsArray();

    /* we first check whether all the card categories exist in the prefs */
    let max = catsArray.length;
    let newCategories = [];
    for (let i = 0; i < max; i++) {
        let catName = catsArray[i];
        if (gSCCardValues.categories.indexOf(catName) == -1
            && newCategories.indexOf(catName) == -1) {
            newCategories.push(catName);
        }
    }
    if (newCategories.length > 0) {
        gSCCardValues.categories = gSCCardValues.categories.concat(newCategories);
        SCContactCategories.setCategoriesAsArray(gSCCardValues.categories);
        gSCCardValues.categories = SCContactCategories.getCategoriesAsArray();
    }

    /* we now add the combo boxes */
    for (let i = 0; i < max; i++) {
        SCAppendCategory(catsArray[i]);
    }
    let emptyField = document.getElementById("abEmptyCategory");
    emptyField.addEventListener("focus", SCOnEmptyFieldFocus, false);

    /* events */
    let tabPanelElement = document.getElementById("abTabPanels");
    let menulists = tabPanelElement.getElementsByTagName("menulist");
    for (let i = 0; i < menulists.length; i++) {
        menulists[i].addEventListener("mouseup", setDocumentDirty, true);
    }

    let textboxes = tabPanelElement.getElementsByTagName("textbox");
    for (let i = 0; i < textboxes.length; i++) {
        textboxes[i].addEventListener("change", setDocumentDirty, true);
    }
}

function SCOnEmptyFieldFocus(event) {
    let newCategory = SCAppendCategory("");
    newCategory.focus();
    event.preventDefault = true;
}

function SCAppendCategory(catValue) {
    let vbox = document.getElementById("abCategories");
    let menuList = document.createElement("menulist");
    menuList.setAttribute("editable", true);
    menuList.addEventListener("blur", SCOnCategoryBlur, false);
    menuList.addEventListener("change", SCOnCategoryChange, false);
    menuList.addEventListener("command", SCOnCategoryChange, false);
    SCResetCategoriesMenu(menuList);
    menuList.value = catValue;
    vbox.appendChild(menuList);

    return menuList;
}

function SCResetCategoriesMenu(menu) {
    let popups = menu.getElementsByTagName("menupopup");
    for (let i = 0; i < popups.length; i++) {
        menu.removeChild(popups[i]);
    }

    let menuPopup = document.createElement("menupopup");
    for (let catName of gSCCardValues.categories) {
        let item = document.createElement("menuitem");
        item.setAttribute("label", catName);
        menuPopup.appendChild(item);
    }
    menu.appendChild(menuPopup);
}

function SCOnCategoryBlur() {
    let value = this.inputField.value
                    .replace(/(^[ ]+|[ ]+$)/, "", "g");
    if (value.length == 0) {
        this.parentNode.removeChild(this);
    }
}

function SCOnCategoryChange() {
    if (this.selectedIndex == -1) { // text field was changed
        let value = this.inputField.value;
        if (value.length > 0) {
            if (gSCCardValues.categories.indexOf(value) < 0) {
                gSCCardValues.categories.push(value);
                SCContactCategories.setCategoriesAsArray(gSCCardValues.categories);
                gSCCardValues.categories = SCContactCategories.getCategoriesAsArray();
                let box = document.getElementById("abCategories");
                let lists = box.getElementsByTagName("menulist");
                for (let i = 0; i < lists.length; i++) {
                    SCResetCategoriesMenu(lists[i]);
                }
            }
        }
    }
}

function SCSaveCategories() {
    let vbox = document.getElementById("abCategories");
    let menuLists = vbox.getElementsByTagName("menulist");
    let catsArray = [];
    for (var i = 0; i < menuLists.length; i++) {
        let value = menuLists[i].inputField.value
                                .replace(/(^[ ]+|[ ]+$)/, "", "g");
        if (value.length > 0 && catsArray.indexOf(value) == -1) {
            catsArray.push(value);
        }
    }
    gEditCard.card.setProperty("Categories", arrayToMultiValue(catsArray));
}

function getUri() {
    let uri;

    if (document.getElementById("abPopup")) {
        uri = document.getElementById("abPopup").value;
    }
    else if (window.arguments[0].abURI) {
        uri = window.arguments[0].abURI;
    }
    else
        uri = window.arguments[0].selectedAB;

    return uri;
}

function setDocumentDirty(boolValue) {
    gSCCardValues.documentDirty = boolValue;
}

function saveCard(isNewCard) {
    try {
        let parentURI = getUri();
        let uriParts = parentURI.split("/");
        parentURI = uriParts[0] + "//" + uriParts[2];

        if (gSCCardValues.documentDirty
            && isGroupdavDirectory(parentURI)) {
            SCSaveCategories();
                         
            let oldDavVersion = gEditCard.card.getProperty("groupDavVersion", "-1");

            gEditCard.card.setProperty("groupDavVersion", "-1");
            gEditCard.card.setProperty("groupDavVersionPrev", oldDavVersion);

            let abManager = Components.classes["@mozilla.org/abmanager;1"]
                                      .getService(Components.interfaces.nsIAbManager);
            let ab = abManager.getDirectory(parentURI);
            ab.modifyCard(gEditCard.card);
/*
            // We make sure we try the messenger window and if it's closed, the address book
            // window. It might fail if both of them are closed and we still have a composition
            // window open and we try to modify the card from there (from the contacts sidebar)
            if (gSCCardValues.messengerWindow)
                gSCCardValues.messengerWindow.SCSynchronizeFromChildWindow(parentURI);
            else
                gSCCardValues.abWindow.SCSynchronizeFromChildWindow(parentURI);
              */
            
            if (gSCCardValues.messengerWindow){
              dump("saveCard messengerWindow.cm2SynchroContactFromChildWindow\n");
                
              if (gEditCard.card.isMailList){
                
                gSCCardValues.messengerWindow.SCSynchronizeFromChildWindow(parentURI);
                
              }
              else{

                gSCCardValues.messengerWindow.cm2SynchroContactFromChildWindow(gEditCard.card, gEditCard.original);     
                
              }
            
            }
            else{
              dump("saveCard abWindow.cm2SynchroContactFromChildWindow\n");
              gSCCardValues.abWindow.cm2SynchroContactFromChildWindow(gEditCard.card, gEditCard.original);
            }

            setDocumentDirty(false);
        }
    }
    catch(e) {
      dump("saveCard exception:"+e);
      //exceptionHandler n'existe pas ! 0005949: Bouton OK de la carte de visite valide mais ne ferme pas la fenêtre
      //gSCCardValues.messengerWindow.exceptionHandler(null, "saveCard", e);
    }
}



// function inverseInitEventHandlers() {
// // 	if (isGroupdavDirectory(getUri()))
// // 		RegisterSaveListener(setGroupDavFields);
// 	inverseSetupFieldsEventHandlers();
// }

function isLDAPDirectory(uri) {
    let ab = GetDirectoryFromURI(uri);

    return (ab.isRemote && !isCardDavDirectory(uri));
}

window.addEventListener("load", SCOnCommonCardOverlayLoad, false);
