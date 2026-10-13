// First-run flags. The practice game marks the Home tour "pending"; the tour clears it when done.
const KEY = "sp.tour";

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage blocked: the tour simply won't show */
  }
};

export const tourPending = () => read() === "pending";
export const queueTour = () => write("pending");
export const finishTour = () => write("done");
