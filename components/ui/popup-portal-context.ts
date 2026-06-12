"use client";

import * as React from "react";

// Lets popups (base-ui Select, etc.) portal INTO the nearest modal surface
// (a vaul Drawer's content node) instead of document.body.
//
// Why this exists: a base-ui Select popup portaled to document.body lands
// OUTSIDE a vaul *modal* Drawer's interaction boundary. The popup renders and
// is visible, but item taps are swallowed as an outside-press/dismiss and never
// fire onValueChange — the list closes and the value never changes (the exact
// settings "며칠에 들어오나요" bug). Portaling the popup into the drawer content
// puts it back inside the modal's interactive subtree, so taps select normally.
//
// DrawerContent publishes its content node here; SelectContent reads it as the
// default Portal container. Outside a Drawer the context is null, so popups fall
// back to document.body as before.
export const PopupPortalContext = React.createContext<HTMLElement | null>(null);
