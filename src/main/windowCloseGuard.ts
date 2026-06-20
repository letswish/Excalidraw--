type CloseEvent = {
  preventDefault: () => void;
};

type WindowCloseGuardOptions = {
  requestCloseConfirmation: () => void;
  closeWindow: () => void;
};

export type WindowCloseGuard = {
  handleClose: (event: CloseEvent) => void;
  approveClose: () => void;
};

export const createWindowCloseGuard = ({
  requestCloseConfirmation,
  closeWindow
}: WindowCloseGuardOptions): WindowCloseGuard => {
  let closeApproved = false;

  return {
    handleClose: (event) => {
      if (closeApproved) {
        return;
      }

      event.preventDefault();
      requestCloseConfirmation();
    },
    approveClose: () => {
      if (closeApproved) {
        return;
      }

      closeApproved = true;
      closeWindow();
    }
  };
};
