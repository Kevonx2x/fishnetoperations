import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    twilio_sid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    twilio_token: Boolean(process.env.TWILIO_AUTH_TOKEN),
    twilio_phone: Boolean(process.env.TWILIO_PHONE_NUMBER),
  });
}
