export interface OtpSender {
  sendOtp(email: string, code: string): Promise<void>;
}

export class MockOtpSender implements OtpSender {
  async sendOtp(email: string, code: string): Promise<void> {
    console.log(`\n[MOCK OTP] To: ${email} | Code: ${code}\n`);
  }
}

let instance: OtpSender | null = null;

export function getOtpSender(): OtpSender {
  if (!instance) {
    instance = new MockOtpSender();
  }
  return instance;
}

export function setOtpSender(sender: OtpSender): void {
  instance = sender;
}
