import { useState } from "react";

/** "Now", captured once per mount — keeps renders pure (react-hooks/purity). */
export const useNow = () => useState(() => Date.now())[0];
