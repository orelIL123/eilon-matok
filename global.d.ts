declare global {
  var pendingVerifications: {
    [verificationId: string]: {
      code: string;
      phone: string;
      timestamp: number;
    };
  } | undefined;
}

export {};