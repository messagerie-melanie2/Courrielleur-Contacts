/* abEditCardDialog.groupdav.overlay.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

/* starting... */
function OnLoadHandler() {
    // LoadFBUrl();
    let uri = getUri();
    let ab = GetDirectoryFromURI(uri);
    if (!ab.isRemote) {
        this.OldEditCardOKButton = this.EditCardOKButton;
        this.EditCardOKButton = this.SCEditCardOKButton;
    }
}

/* event handlers */
function SCEditCardOKButton() {
  
  // mantis 4392
  gEditCard.original=Components.classes["@mozilla.org/addressbook/moz-abmdbcard;1"]
                              .createInstance(Components.interfaces.nsIAbCard);
  gEditCard.original.copy(gEditCard.card);
  // fin mantis 4392
  
    let result = this.OldEditCardOKButton();
    if (result) {
        let ab = GetDirectoryFromURI(gEditCard.abURI);
        if (!ab.isRemote) {
            setDocumentDirty(true);
            // UpdateFBUrl();
            saveCard(false);
        }
    }

    return result;
}

window.addEventListener("load", OnLoadHandler, false);
