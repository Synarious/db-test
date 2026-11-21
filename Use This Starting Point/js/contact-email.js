(function () {
    'use strict';

    const contact = document.querySelector('#contact-email');
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'secondary';
    reveal.textContent = 'Show contact email';
    contact.append(reveal);

    reveal.addEventListener('click', () => {
        const first = 2 + Math.floor(Math.random() * 8);
        const second = 2 + Math.floor(Math.random() * 8);
        const form = document.createElement('form');
        form.className = 'actions';
        const label = document.createElement('label');
        label.textContent = 'What is ' + first + ' + ' + second + '? ';
        const answer = document.createElement('input');
        answer.inputMode = 'numeric';
        answer.size = 4;
        answer.required = true;
        label.append(answer);
        const verify = document.createElement('button');
        verify.type = 'submit';
        verify.textContent = 'Verify';
        const status = document.createElement('span');
        status.setAttribute('role', 'status');
        form.append(label, verify, status);
        contact.replaceChildren(form);
        answer.focus();

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (answer.value.trim() !== String(first + second)) {
                status.textContent = 'That answer is incorrect. Try again.';
                answer.select();
                return;
            }
            // Obfuscate the address from simple source scans.
            const encoded = [42, 38, 39, 61, 40, 42, 61, 9, 45, 44, 63, 32, 40, 39, 61, 43, 38, 60, 39, 45, 103, 42, 38, 36];
            const address = String.fromCharCode(...encoded.map(code => code ^ 73));
            const link = document.createElement('a');
            link.href = 'mailto:' + address;
            link.textContent = address;
            contact.replaceChildren(link);
            link.focus();
        });
    });
})();
