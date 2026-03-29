import { Resend } from "resend"
import { NextResponse } from "next/server"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const body = await req.json()
  const { name, email, phone, property_interest, message } = body

  const { error } = await resend.emails.send({
    from: "Fishnet Operations <onboarding@resend.dev>",
    to: "ron.business101@gmail.com",
    subject: `New Lead: ${name} is interested in ${property_interest}`,
    html: `
      <h2>New Viewing Request</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Property Interest:</strong> ${property_interest}</p>
      <p><strong>Message:</strong> ${message}</p>
    `,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}