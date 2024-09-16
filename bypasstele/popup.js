document.querySelector('.btn-get-query-id').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getQueryId' }, (response) => {
            if (response.query_id) {
                const encodedQueryId = response.query_id.replace(/[&<>'"]/g, 
                    tag => ({
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        "'": '&#39;',
                        '"': '&quot;'
                    }[tag] || tag)
                );

                const alertDiv = document.createElement('div');
                alertDiv.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: white;
                    padding: 20px;
                    border-radius: 5px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    z-index: 10000;
                    max-width: 80%;
                    max-height: 80%;
                    overflow: auto;
                `;

                const message = document.createElement('p');
                message.innerHTML = `Query ID: <br><pre style="white-space: pre-wrap; word-break: break-all;">${encodedQueryId}</pre>`;

                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy Query ID';
                copyButton.style.marginTop = '10px';
                copyButton.addEventListener('click', () => {
                    navigator.clipboard.writeText(response.query_id).then(() => {
                        copyButton.textContent = 'Copied!';
                        setTimeout(() => {
                            copyButton.textContent = 'Copy Query ID';
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy query ID:', err);
                        copyButton.textContent = 'Copy failed';
                        setTimeout(() => {
                            copyButton.textContent = 'Copy Query ID';
                        }, 2000);
                    });
                });

                const closeButton = document.createElement('button');
                closeButton.textContent = 'Close';
                closeButton.style.marginLeft = '10px';
                closeButton.addEventListener('click', () => {
                    document.body.removeChild(alertDiv);
                });

                alertDiv.appendChild(message);
                alertDiv.appendChild(copyButton);
                alertDiv.appendChild(closeButton);

                document.body.appendChild(alertDiv);
                document.getElementById('message').style.display = 'block';
            } else {
                alert('Could not retrieve query_id.');
            }
        });
    });
});