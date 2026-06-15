async function testMaildrop() {
  try {
    const res = await fetch('https://maildrop.cc/api/inboxes/flowdaytest');
    const data = await res.json();
    console.log('Maildrop response:', data);
  } catch (err) {
    console.error('Error fetching Maildrop:', err);
  }
}
testMaildrop();
