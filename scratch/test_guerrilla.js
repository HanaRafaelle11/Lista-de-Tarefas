async function testGuerrilla() {
  try {
    const res = await fetch('https://www.guerrillamail.com/ajax.php?f=get_email_address');
    const data = await res.json();
    console.log('Guerrilla response:', data);
  } catch (err) {
    console.error('Error fetching Guerrilla:', err);
  }
}
testGuerrilla();
