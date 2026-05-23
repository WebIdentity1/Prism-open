# SMS Compliance Template

This template is for self-hosted Prism deployments that enable Twilio SMS.

Prism is open-source software. The person or business running a deployment is responsible for its own Twilio account, sender registration, consent records, message copy, STOP/HELP handling, privacy policy, and local legal/compliance review.

Do not use this template as legal advice. Adapt it with counsel or a compliance professional before sending messages to real clients.

## Deployment Owner

- Business name:
- Twilio account owner:
- Public website:
- Support contact:
- Countries/regions where SMS will be sent:
- SMS use case:

## Message Types

Prism SMS should be transactional unless the deployer has separately configured compliant marketing consent.

Expected transactional examples:

- Appointment confirmations
- Appointment reminders
- Pre-visit check-in links
- Booking change notices
- Client onboarding links
- Payment links when requested by the client or salon

Marketing examples that need separate consent and review:

- Promotions
- Win-back campaigns
- Discount announcements
- Newsletter-style blasts

## Consent Collection

Document every place where a client can opt in.

### Client-entered consent

Location:

Exact checkbox or disclosure text:

```text
I agree to receive transactional SMS messages from {Salon Name} at the number above, including appointment confirmations, reminders, check-in links, and booking changes. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe and HELP for help. Consent is not a condition of purchase.
```

Stored evidence:

- Client identifier
- Salon identifier
- Phone number
- UTC timestamp
- Disclosure text version
- Consent source
- Staff user, if applicable

### Staff-attested consent

Location:

Exact staff attestation text:

```text
I confirm {Client Name} gave consent to receive transactional SMS messages from this salon at {Phone Number}. I understand STOP unsubscribes the client and HELP returns help text.
```

Stored evidence:

- Client identifier
- Salon identifier
- Phone number
- UTC timestamp
- Staff user identifier
- Disclosure or attestation text version

## STOP And HELP

Confirm how STOP and HELP are handled for the sender.

STOP response:

```text
You have been unsubscribed and will no longer receive SMS messages from {Business or Salon Name}. Reply START to resubscribe.
```

HELP response:

```text
{Business or Salon Name}: For help, contact {support contact}. Reply STOP to unsubscribe.
```

## Data Sharing Statement

Recommended policy language to adapt:

```text
No mobile information, including phone numbers and SMS opt-in status, is shared with third parties or affiliates for marketing or promotional purposes. SMS data may be shared with service providers only as needed to deliver transactional messages.
```

## Twilio Readiness Checklist

- [ ] Twilio account is owned by the deployment owner.
- [ ] Sending number or messaging service is approved for the intended use case.
- [ ] Consent collection is enabled before any SMS is sent.
- [ ] STOP and HELP responses are configured and tested.
- [ ] Privacy policy includes SMS data-sharing language.
- [ ] Test messages identify the salon or deployment owner.
- [ ] Production sending is disabled until compliance review is complete.

## Prism Configuration Checklist

- [ ] `TWILIO_ACCOUNT_SID` is set as a Supabase Edge Function secret.
- [ ] `TWILIO_AUTH_TOKEN` is set as a Supabase Edge Function secret.
- [ ] `TWILIO_PHONE_NUMBER` is set as a Supabase Edge Function secret.
- [ ] `PUBLIC_SITE_URL` and `SITE_URL` point to the deployed frontend.
- [ ] Demo mode is disabled for production.
- [ ] A test appointment confirms SMS behavior with a consenting test number.
