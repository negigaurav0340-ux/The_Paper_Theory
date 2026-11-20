'use strict';
// Email templates for the order flow. Every customer-supplied value is escaped before it enters HTML.
const { escapeHtml: e, money, istTime } = require('./store.cjs');

const INK = '#24251f', PAPER = '#faf7f0', LINE = '#dcded1', ORANGE = '#ed693e', MUTED = '#686c60', GREEN = '#39654d';
const WHATSAPP = '+91 82195 78050';

const address = c => [c.house, c.street, c.landmark, c.city, c.district, c.state, c.pin, c.country].filter(Boolean).join(', ');
const itemLabel = item => [item.name, item.option].filter(Boolean).join(' · ');

function shell(title, inner, footer = '') {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ece9e1;font-family:Arial,Helvetica,sans-serif;color:${INK}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece9e1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${PAPER};border:1px solid ${LINE}">
<tr><td style="padding:20px 28px;background:${INK};color:#fff;font-size:13px;letter-spacing:2px;font-weight:bold">THE PAPER THEORY</td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.25">${title}</h1>${inner}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${LINE};font-size:12px;line-height:1.6;color:${MUTED}">${footer || `Questions? Reply to this email or message us on WhatsApp at ${WHATSAPP}.<br>The Paper Theory · thepapertheory.in`}</td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(order) {
  const rows = order.items.map(item => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;line-height:1.5"><b>${e(item.name)}</b>${item.option ? `<br><span style="color:${MUTED};font-size:12px">${e(item.option)}</span>` : ''}${item.selection ? `<br><span style="color:${MUTED};font-size:12px">${e(item.selection)}</span>` : ''}</td>
<td align="center" style="padding:10px 8px;border-bottom:1px solid ${LINE};font-size:14px;white-space:nowrap">× ${item.quantity}</td>
<td align="right" style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;white-space:nowrap">${item.lineTotal == null ? 'Quote' : money(item.lineTotal)}</td></tr>`).join('');
  const line = (label, value, bold) => `<tr><td colspan="2" style="padding:6px 0;font-size:14px${bold ? ';font-weight:bold;font-size:16px' : ''}">${label}</td><td align="right" style="padding:6px 0;font-size:14px;white-space:nowrap${bold ? ';font-weight:bold;font-size:16px' : ''}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}
${line('Product subtotal', money(order.subtotal))}
${order.discount ? line(e('Bundle saving · ' + order.discountLabel), '−' + money(order.discount)) : ''}
${order.adjustment ? line(e(order.adjustmentLabel || 'Custom items / adjustment'), money(order.adjustment)) : ''}
${line('Shipping', order.shipping == null ? 'To be confirmed' : order.shipping === 0 ? 'Free' : money(order.shipping))}
${line('Total', order.total == null ? 'To be confirmed' : money(order.total), true)}</table>`;
}

function itemsPlain(order) {
  return order.items.map(item => `- ${itemLabel(item)}${item.selection ? ' [' + item.selection + ']' : ''} x ${item.quantity} = ${item.lineTotal == null ? 'Quote' : money(item.lineTotal)}`).join('\n') +
    `\nSubtotal: ${money(order.subtotal)}${order.discount ? `\nBundle saving (${order.discountLabel}): -${money(order.discount)}` : ''}${order.adjustment ? `\n${order.adjustmentLabel || 'Adjustment'}: ${money(order.adjustment)}` : ''}\nShipping: ${order.shipping == null ? 'To be confirmed' : order.shipping === 0 ? 'Free' : money(order.shipping)}\nTotal: ${order.total == null ? 'To be confirmed' : money(order.total)}`;
}

const deliveryBlock = order => `<p style="margin:18px 0 6px;font-size:11px;letter-spacing:1.5px;font-weight:bold;color:${ORANGE}">DELIVER TO</p>
<p style="margin:0;font-size:14px;line-height:1.6">${e(order.customer.name)} · ${e(order.customer.phone)}<br>${e(address(order.customer))}</p>`;
const button = (href, label, colour = ORANGE) => `<p style="margin:22px 0"><a href="${e(href)}" style="display:inline-block;padding:14px 24px;background:${colour};color:#fff;text-decoration:none;font-weight:bold;font-size:15px">${label}</a></p>`;
const noteBlock = note => note ? `<p style="margin:16px 0;padding:12px 14px;background:#fff;border-left:3px solid ${ORANGE};font-size:14px;line-height:1.6">${e(note).replace(/\n/g, '<br>')}</p>` : '';

// Sent to the store inbox the moment an order is placed. The button opens the order panel for this order.
function ownerAlert(order, link) {
  const c = order.customer;
  const html = shell(`New order ${e(order.id)}`, `
<p style="margin:0 0 18px;font-size:15px;line-height:1.6">${e(c.name)} from ${e(c.city)} placed an order worth <b>${money(order.subtotal - (order.discount || 0))}</b> on ${e(istTime(order.createdAt))}.</p>
${itemsTable(order)}
${order.unverified ? `<p style="margin:14px 0;padding:10px 12px;background:#fff5df;font-size:13px;line-height:1.5">Check prices: one or more items could not be matched against the published catalogue.</p>` : ''}
${deliveryBlock(order)}
<p style="margin:14px 0 0;font-size:14px;line-height:1.6">Email: <a href="mailto:${e(c.email)}">${e(c.email)}</a><br>WhatsApp / phone: ${e(c.phone)}</p>
${order.note ? `<p style="margin:18px 0 6px;font-size:11px;letter-spacing:1.5px;font-weight:bold;color:${ORANGE}">CUSTOMER NOTE</p>${noteBlock(order.note)}` : ''}
${button(link, 'Review &amp; confirm this order →')}
<p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED}">Confirming sends ${e(c.name.split(' ')[0])} the order details and the payment request by email. Nothing is sent to the customer until you confirm.</p>`,
    'You are receiving this because an order was placed on thepapertheory.in. Replying to this email writes to the customer.');
  const plain = `New order ${order.id}\n${c.name} · ${c.phone} · ${c.email}\n${address(c)}\n\n${itemsPlain(order)}\n${order.note ? '\nCustomer note: ' + order.note + '\n' : ''}\nReview and confirm: ${link}`;
  return { subject: `New order ${order.id} · ${money(order.subtotal - (order.discount || 0))} · ${c.name} (${c.city})`, html, plain };
}

// Sent to the customer when the owner confirms: order details plus the payment request.
function customerConfirm(order, settings, hasQr) {
  const first = order.customer.name.split(' ')[0];
  const upi = settings?.upiId ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6">UPI ID: <b>${e(settings.upiId)}</b>${settings.payeeName ? ` (${e(settings.payeeName)})` : ''}</p>` : '';
  const pay = order.total == null
    ? `<p style="margin:0;font-size:14px;line-height:1.6">We will confirm your final amount shortly.</p>`
    : `<p style="margin:0;font-size:13px;color:${MUTED}">AMOUNT TO PAY</p><p style="margin:4px 0 10px;font-family:Georgia,serif;font-size:34px">${money(order.total)}</p>
${hasQr ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.6">Scan this QR code with any UPI app and pay <b>${money(order.total)}</b>.</p><img src="cid:payqr" alt="Payment QR code" width="240" style="display:block;width:240px;max-width:100%;height:auto;border:1px solid ${LINE};background:#fff">` : ''}${upi}
${!hasQr && !settings?.upiId ? `<p style="margin:0;font-size:14px;line-height:1.6">Reply to this email and we will send you the payment details.</p>` : ''}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6">${e(settings?.instructions || `After paying, reply to this email with the payment screenshot or UPI reference and mention order ${order.id}. We start preparing your order once the payment is verified.`)}</p>`;
  const html = shell(`Your order is confirmed, ${e(first)}.`, `
<p style="margin:0 0 6px;font-size:15px;line-height:1.6">Thank you for ordering from The Paper Theory. Everything in order <b>${e(order.id)}</b> is available.</p>
${noteBlock(order.ownerNote)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#fff;border:1px solid ${LINE}"><tr><td style="padding:20px">${pay}</td></tr></table>
<p style="margin:18px 0 6px;font-size:11px;letter-spacing:1.5px;font-weight:bold;color:${ORANGE}">YOUR ORDER</p>
${itemsTable(order)}
${deliveryBlock(order)}`);
  const plain = `Hi ${first},\n\nYour order ${order.id} from The Paper Theory is confirmed.\n${order.ownerNote ? '\n' + order.ownerNote + '\n' : ''}\n${itemsPlain(order)}\n\nAmount to pay: ${order.total == null ? 'to be confirmed' : money(order.total)}${settings?.upiId ? '\nUPI ID: ' + settings.upiId : ''}${hasQr ? '\nThe payment QR code is attached to this email.' : ''}\n\n${settings?.instructions || `After paying, reply to this email with the payment screenshot or UPI reference and mention order ${order.id}.`}\n\nDeliver to: ${order.customer.name}, ${address(order.customer)}\n\nThe Paper Theory · WhatsApp ${WHATSAPP}`;
  return { subject: `Order ${order.id} confirmed · pay ${order.total == null ? '' : money(order.total)} to complete it`.replace('  ', ' '), html, plain };
}

function customerPaid(order) {
  const first = order.customer.name.split(' ')[0];
  const html = shell(`Payment received. Thank you, ${e(first)}.`, `
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">We have received <b>${money(order.total)}</b> for order <b>${e(order.id)}</b> and are preparing it now. We will email you again when it ships.</p>
${noteBlock(order.ownerNote)}${itemsTable(order)}${deliveryBlock(order)}`);
  return { subject: `Payment received for order ${order.id}`, html, plain: `Hi ${first},\n\nWe have received ${money(order.total)} for order ${order.id} and are preparing it now. We will email you again when it ships.\n\n${itemsPlain(order)}\n\nThe Paper Theory · WhatsApp ${WHATSAPP}` };
}

function customerShipped(order, site) {
  const first = order.customer.name.split(' ')[0], t = order.tracking || {};
  // Ask for a review once the parcel is on its way; the link opens the first product they bought.
  const bought = order.items.find(i => /^[A-Z0-9-]{3,40}$/.test(i.productId || '')), reviewLink = site && bought ? `${site}/index.html?product=${encodeURIComponent(bought.productId)}` : '';
  const review = reviewLink ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6">When it arrives, tell other shoppers how it looks. A short review with a photo helps a small shop a lot.</p>${button(reviewLink, 'Leave a review', GREEN)}` : '';
  const track = t.courier || t.number ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${t.courier ? 'Courier: <b>' + e(t.courier) + '</b>' : ''}${t.courier && t.number ? '<br>' : ''}${t.number ? 'Tracking number: <b>' + e(t.number) + '</b>' : ''}</p>` : '';
  const html = shell(`Your order is on its way, ${e(first)}.`, `
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Order <b>${e(order.id)}</b> has been dispatched.</p>${track}${noteBlock(order.ownerNote)}${itemsTable(order)}${deliveryBlock(order)}${review}`);
  return { subject: `Order ${order.id} has shipped`, html, plain: `Hi ${first},\n\nOrder ${order.id} has been dispatched.${t.courier ? '\nCourier: ' + t.courier : ''}${t.number ? '\nTracking number: ' + t.number : ''}\n\n${itemsPlain(order)}${reviewLink ? '\n\nWhen it arrives, leave a review: ' + reviewLink : ''}\n\nThe Paper Theory · WhatsApp ${WHATSAPP}` };
}

function customerCancelled(order) {
  const first = order.customer.name.split(' ')[0];
  const html = shell(`Order ${e(order.id)} was cancelled.`, `
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${e(first)}, we could not go ahead with this order.</p>${noteBlock(order.cancelReason)}
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">If you have already paid, reply to this email and we will sort it out.</p>${itemsTable(order)}`);
  return { subject: `Order ${order.id} cancelled`, html, plain: `Hi ${first},\n\nWe could not go ahead with order ${order.id}.${order.cancelReason ? '\n' + order.cancelReason : ''}\nIf you have already paid, reply to this email and we will sort it out.\n\nThe Paper Theory · WhatsApp ${WHATSAPP}` };
}

function testEmail() {
  return { subject: 'The Paper Theory: order emails are working', html: shell('Order emails are working.', `<p style="margin:0;font-size:15px;line-height:1.6">This test was sent from your orders panel. New orders will arrive in this inbox with a button to review and confirm them.</p>`), plain: 'Order emails are working. New orders will arrive in this inbox with a link to review and confirm them.' };
}

module.exports = { ownerAlert, customerConfirm, customerPaid, customerShipped, customerCancelled, testEmail, address };
