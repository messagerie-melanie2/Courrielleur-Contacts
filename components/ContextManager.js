/* ContextManager.js - This file is part of "SOGo Connector", a Thunderbird extension.
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

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

function ContextManager() {
    this.contexts = {};
    this.wrappedJSObject = this;
}

ContextManager.prototype = {
    /* nsIClassInfo */
    classID: Components.ID("{dc93fc98-bec6-11dc-b37a-00163e47dbb4}"),
    contractID: "@inverse.ca/context-manager;1",
    classDescription: "Global context manager",

    getInterfaces: function cDACLM_getInterfaces(count) {
        const ifaces = [Components.interfaces.inverseIJSContextManager,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function cDACLM_getHelperForLanguage(language) {
        return null;
    },
    flags: 0,

    /* inverseIJSContextManager */
    contexts: null,
    wrappedJSObject: null,

    getContext: function(name) {
        let context = this.contexts[name];
        if (!context) {
            context = {};
            this.contexts[name] = context;
        }

        return context;
    },
    resetContext: function(name) {
        let context = this.contexts[name];
        if (context)
            this.contexts[name] = null;
    },
    QueryInterface: function(aIID) {
        if (!aIID.equals(Components.interfaces.inverseIJSContextManager)
            && !aIID.equals(Components.interfaces.nsISupports))
            throw Components.results.NS_ERROR_NO_INTERFACE;

        return this;
    }
};

/** Module Registration */
function NSGetFactory(cid) {
    return (XPCOMUtils.generateNSGetFactory([ContextManager]))(cid);
}
