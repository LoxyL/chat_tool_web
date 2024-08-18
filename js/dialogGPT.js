import {BotGPT, AgentGPT} from "./botGPT.js";

export class DialogGPT {
	constructor() {
		this.dialog_num = 0;
		this.bot = new BotGPT();
		this.dialog_num++;
		this.agent = new AgentGPT();
		this.current_record_id = 0;
		this._loadRecordList();
		this.useAgent = true;
	}

	_getInputGPT() {
		let inputElement = document.getElementById("message-send-GPT");
		let inputValue = inputElement.value;
		inputElement.value = "";
		
		inputElement.style.height = 'auto';
		inputElement.style.height = (this.scrollHeight) + 'px';

		return inputValue.trim();
	}

	_processRawDisplay(text) {
		return text
			.replace(/&/g, "&amp;") 
			.replace(/</g, "&lt;")  
			.replace(/>/g, "&gt;")  
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	_processTextDisplay(text) {
		const md = new markdownit({
			highlight: function(code, lang) {
				if (lang && hljs.getLanguage(lang)) {
					return hljs.highlight(code, { language: lang }).value;
				}
				return hljs.highlightAuto(code).value;
			}
		});

		let html = md.render(text);
		return html;
	}

	_clear() {
		this.dialog_num = 0;
		const container = document.getElementById('chat-container-GPT-messages');
		container.innerHTML = '';
		this.bot = new BotGPT();
		this.dialog_num++;
	}

	_switchMessage(bubble) {
		if(bubble.classList.contains('raw')){
			bubble.classList.remove('raw');
		} else {
			bubble.classList.add('raw');
		}
	}

	async _deleteMessage(id) {
		console.log(`[INFO]Delete message ${id}`);

		this.bot.deleteMessage(id);
		await this._saveRecordContent();
		this._loadRecordContent();
	}

	_bubbleInteract() {
		let rightClickCount = 0;
		let lastRightClickTime = 0;

		const botBubbles = document.querySelectorAll('.chat-container-GPT-messages-bot-bubble');
		const userBubbles = document.querySelectorAll('.chat-container-GPT-messages-user-bubble');

		let ctrlPressed = false;

		window.addEventListener('keydown', event => {
			if(event.ctrlKey) ctrlPressed = true;
		})

		window.addEventListener('keyup', event => {
			if(event.key === 'Control') ctrlPressed = false;
		})

		botBubbles.forEach(bubble => {
			const rawContent = bubble.lastElementChild.innerHTML;

			let deleteTimer;
			let regenerateTimer;

			bubble.addEventListener('contextmenu', event => {
				event.preventDefault();

				const currentTime = new Date().getTime();

				if(currentTime - lastRightClickTime < 500){
					rightClickCount++;
				} else {
					rightClickCount = 1;
				}
				lastRightClickTime = currentTime;

				if(rightClickCount === 2){
					this._switchMessage(bubble);
				}
			})

			bubble.addEventListener('click', event => {
				const currentTime = new Date().getTime();

				if(currentTime - lastRightClickTime < 500){
					navigator.clipboard.writeText(rawContent)
					.then(() => {
						bubble.classList.add('succeed');
						setTimeout(() => {
							bubble.classList.remove('succeed');
						}, 500)
					})
					.catch(err => {
						console.error("[INFO]Message copy error:", err);
					})
				}
			})

			bubble.addEventListener('mousedown', (event) => {
				if(event.button === 0 && ctrlPressed){
					bubble.classList.add('delete');

					const setId = bubble.parentNode.id.split('-');
					const messageId = Number(setId[setId.length-1]);
					
					deleteTimer = setTimeout(() => {
						this._deleteMessage(messageId);
					}, 1000);
				} else if(event.button === 2 && ctrlPressed){
					bubble.classList.add('regenerate');

					const setId = bubble.parentNode.id.split('-');
					const messageId = Number(setId[setId.length-1]);
					
					clearTimeout(regenerateTimer);
					regenerateTimer = setTimeout(() => {
						this._regenerateResponse(messageId);
						bubble.classList.remove('regenerate');
					}, 1000);
				}
			});

			bubble.addEventListener('mouseup', function() {
				clearTimeout(deleteTimer);
				clearTimeout(regenerateTimer);
				bubble.classList.remove('delete');
			})

			bubble.addEventListener('mouseleave', function() {
				clearTimeout(deleteTimer);
				clearTimeout(regenerateTimer);
				bubble.classList.remove('delete');
			})
		})

		userBubbles.forEach(bubble => {
			let timer;

			bubble.addEventListener('mousedown', (event) => {
				if(event.button === 0 && ctrlPressed){
					bubble.classList.add('delete');

					const setId = bubble.parentNode.id.split('-');
					const messageId = Number(setId[setId.length-1]);
					
					timer = setTimeout(() => {
						this._deleteMessage(messageId);
					}, 1000);
				}
			});

			bubble.addEventListener('mouseup', function() {
				clearTimeout(timer);
				bubble.classList.remove('delete');
			})

			bubble.addEventListener('mouseleave', function() {
				clearTimeout(timer);
				bubble.classList.remove('delete');
			})
		})
	}

	_codeInteract() {
		const codeBlocks = document.querySelectorAll('code');
		
		codeBlocks.forEach(block => {
			let timer;
			const container = block.parentNode;

			const childNodes = container.childNodes;
			if (container.nodeName === 'PRE' && childNodes.length === 1 && childNodes[0].nodeName === 'CODE') {
				container.setAttribute("class", "code-block");
			} else {
				return;
			}

			let name = block.className.replace('language-', '');
			if(!name) name = 'code';
			container.setAttribute('code-language', name);

			container.addEventListener('contextmenu', function(event) {
				event.preventDefault();
			});

			container.addEventListener('mousedown', function(event) {
				if(event.button === 2){
					container.classList.add('active');
					
					timer = setTimeout(() => {
						navigator.clipboard.writeText(container.textContent)
							.then(() => {
								container.classList.remove('active');
								container.classList.add('succeed');
							})
							.catch(err => {
								container.classList.remove('active');
								container.classList.add('fail');
								console.error("[INFO]Code copy error:", err);
							})
					}, 1000)
				}
			});

			container.addEventListener('mouseup', function() {
				clearTimeout(timer);
				container.classList.remove('active');
				container.classList.remove('succeed');
				container.classList.remove('fail');
			})

			container.addEventListener('mouseleave', function() {
				clearTimeout(timer);
				container.classList.remove('active');
				container.classList.remove('succeed');
				container.classList.remove('fail');
			})
		});

	}

	_send_message(inputValue) {
		const userSet = document.createElement("div");
		userSet.setAttribute("id", 'chat-container-GPT-messages-user-'+this.dialog_num);
		userSet.setAttribute("class", "chat-container-GPT-messages-user");

		const userIcon = document.createElement("div");
		userIcon.setAttribute("class", "chat-container-GPT-messages-user-icon");
		userIcon.innerHTML = "U";

		const userBubble = document.createElement("div");
		userBubble.setAttribute("class", "chat-container-GPT-messages-user-bubble");
		userBubble.innerHTML = `<pre>${this._processRawDisplay(inputValue)}</pre>`;

		userSet.appendChild(userIcon);
		userSet.appendChild(userBubble);
		
		const chatContainer = document.getElementById("chat-container-GPT-messages");
		chatContainer.appendChild(userSet);

		chatContainer.scrollTop = chatContainer.scrollHeight;
	}

	async _receive_message(inputValue) {
		let contentIter = this.bot.interact(inputValue);
		let receive_content = "";
		
		const chatContainer = document.getElementById("chat-container-GPT-messages");

		const botSet = document.createElement("div");
		botSet.setAttribute("id", 'chat-container-GPT-messages-bot-'+this.dialog_num);
		botSet.setAttribute("class", "chat-container-GPT-messages-bot");

		const botIcon = document.createElement("div");
		botIcon.setAttribute("class", "chat-container-GPT-messages-bot-icon");
		botIcon.innerHTML = "B";

		const botBubble = document.createElement("div");
		botBubble.setAttribute("class", "chat-container-GPT-messages-bot-bubble");
		botBubble.innerHTML = this._processTextDisplay("...");

		botSet.appendChild(botIcon);
		botSet.appendChild(botBubble);
		chatContainer.appendChild(botSet);
		chatContainer.scrollTop = chatContainer.scrollHeight;

		for await (const piece of contentIter) {
			if (piece == undefined) continue;
			receive_content += piece;
			botBubble.innerHTML = this._processTextDisplay(receive_content);
			renderMathInElement(botSet, {
				delimiters: [
					{left: "$$", right: "$$", display: true},
					{left: "$", right: "$", display: false}
				]
			});
			this._codeInteract();
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}

		const rawContainer = document.createElement('pre');
		rawContainer.setAttribute("id", "raw-message");
		rawContainer.innerHTML = this._processRawDisplay(receive_content);
		botBubble.appendChild(rawContainer);
		
		this._bubbleInteract();
		console.log("[INFO]Done receive content.");
	}

	streamStop() {
		this.bot.streamAbort();
	}

	_switchToStopButton() {
		document.getElementById("send-button").style.display = 'none';
		document.getElementById("stop-button").style.display = 'block';
	}

	_switchToSendButton() {
		document.getElementById("send-button").style.display = 'block';
		document.getElementById("stop-button").style.display = 'none';
	}

	async send() {
		let inputValue = this._getInputGPT();
		if(inputValue !== ""){
			window.isInteracting = true;
			this._switchToStopButton();
			console.log("[INFO]Send content: ", inputValue);
			this._send_message(inputValue);
			this.dialog_num += 1;
			await this._receive_message(inputValue);
			this.dialog_num += 1;
			await this._saveRecordContent();
			await this._nameRecord();
			this._switchToSendButton();
			window.isInteracting = false;
		} 
	}

	async _regenerateResponse(id) {
		if(window.isInteracting) return;
		window.isInteracting = true;
		this._switchToStopButton();

		const contentIter = this.bot.regenerateMessage(id);

		const botBubble = document.getElementById('chat-container-GPT-messages-bot-'+id).querySelector('.chat-container-GPT-messages-bot-bubble');
		botBubble.innerHTML = this._processTextDisplay("...");

		let receive_content = '';
		for await (const piece of contentIter) {
			if (piece == undefined) continue;
			receive_content += piece;
			botBubble.innerHTML = this._processTextDisplay(receive_content);
			renderMathInElement(botBubble, {
				delimiters: [
					{left: "$$", right: "$$", display: true},
					{left: "$", right: "$", display: false}
				]
			});
			this._codeInteract();
		}

		const rawContainer = document.createElement('pre');
		rawContainer.setAttribute("id", "raw-message");
		rawContainer.innerHTML = this._processRawDisplay(receive_content);
		botBubble.appendChild(rawContainer);
		
		this._bubbleInteract();
		console.log("[INFO]Done receive content.");

		this._saveRecordContent();
		
		this._switchToSendButton();
		window.isInteracting = false;
	}

	async _getRecordData() {
		try {
			const response = await fetch('http://localhost:30962/gpt/record');
			const data = await response.json();
			return data;
		} catch (error) {
			console.log('[INFO]Error reading record:', error);
			return undefined;
		}
	}

	async _saveRecordData(data) {
		try {
			fetch('http://localhost:30962/gpt/record', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			});
		} catch (error) {
			console.error('Error:', error);
		}
	}

	async _loadRecordList() {
		const recordList = await this._getRecordData();
		if(!recordList || recordList.recordIds.length == 0){
			const newRecordList = {
				recordIds: [0],
				recordTitles: ['New Chat'],
				recordContents: [[]]
			};
			await this._saveRecordData(newRecordList);
			this._loadRecordList();
			return;
		}
		this.current_record_id = recordList.recordIds[0];

		const recordContainer = document.getElementById('record-container-GPT');
		recordContainer.innerHTML = '';
		for(let i=0; i<recordList.recordIds.length; i++){
			let newRecord = document.createElement('button');
			newRecord.setAttribute('id', `record-GPT-${recordList.recordIds[i]}`);
			newRecord.setAttribute('class', 'record-option');
			newRecord.setAttribute('onclick', `switchRecord(${recordList.recordIds[i]})`)
			newRecord.innerHTML = `<div>${recordList.recordTitles[i]}</div>`;
			
			let deleteButton = document.createElement('button');
			deleteButton.setAttribute('class', 'record-option-delete');
			deleteButton.setAttribute('onclick', `deleteRecord(${recordList.recordIds[i]})`)
			deleteButton.innerHTML = '&times';

			newRecord.appendChild(deleteButton);
			recordContainer.appendChild(newRecord);
		}

		this.switchRecord(this.current_record_id);
	}

	async _saveRecordContent() {
		let context = JSON.parse(JSON.stringify(this.bot.body.messages));
		context.shift();
		const recordList = await this._getRecordData();;
		let index = recordList.recordIds.indexOf(this.current_record_id);
		recordList.recordContents[index] = context;
		await this._saveRecordData(recordList);
	}
	
	async newChat() {
		this._clear();
		const recordList = await this._getRecordData();
		console.log('Done');
		this.current_record_id = recordList.recordIds[0] + 1;
		recordList.recordIds.unshift(this.current_record_id);
		recordList.recordTitles.unshift('New Chat');
		recordList.recordContents.unshift([]);
		await this._saveRecordData(recordList);
		await this._saveRecordContent();
		await this._loadRecordList();
		this._loadRecordContent();
	}

	async deleteRecord(id) {
		const recordList = await this._getRecordData();
		let index = recordList.recordIds.indexOf(id);
		recordList.recordIds.splice(index, 1);
		recordList.recordTitles.splice(index, 1);
		recordList.recordContents.splice(index, 1);
		await this._saveRecordData(recordList);
		this._loadRecordList();
	}

	async switchRecord(id){
		try {
			this.current_record_id = id;
			this._loadRecordContent();

			const options = document.getElementsByClassName('record-option');
			for(let i=0; i<options.length; i++){
				options[i].className = options[i].className.replace(' active', '');
			}

			const option = document.getElementById(`record-GPT-${id}`);
			option.className += ' active';
		} catch (error) {
			this._loadRecordList();
		}
	}
	
	async _loadRecordContent() {
		this._clear();
		const recordList = await this._getRecordData();
		let index = recordList.recordIds.indexOf(this.current_record_id);
		let recordContents = recordList.recordContents[index];
		for(let i=0; i<recordContents.length; i++){
			this.bot.body.messages.push(recordContents[i]);
		}
		
		for(let i in recordContents){
			const piece = recordContents[i];
			const chatContainer = document.getElementById("chat-container-GPT-messages");
			if(piece.role == 'user'){
				const userSet = document.createElement("div");
				userSet.setAttribute("id", 'chat-container-GPT-messages-user-'+this.dialog_num);
				userSet.setAttribute("class", "chat-container-GPT-messages-user");
		
				const userIcon = document.createElement("div");
				userIcon.setAttribute("class", "chat-container-GPT-messages-user-icon");
				userIcon.innerHTML = "U";
		
				const userBubble = document.createElement("div");
				userBubble.setAttribute("class", "chat-container-GPT-messages-user-bubble");
				userBubble.innerHTML = `<pre>${this._processRawDisplay(piece.content)}</pre>`;
		
				userSet.appendChild(userIcon);
				userSet.appendChild(userBubble);
				
				chatContainer.appendChild(userSet);
			}
			if(piece.role == 'assistant'){
				const botSet = document.createElement("div");
				botSet.setAttribute("id", 'chat-container-GPT-messages-bot-'+this.dialog_num);
				botSet.setAttribute("class", "chat-container-GPT-messages-bot");
		
				const botIcon = document.createElement("div");
				botIcon.setAttribute("class", "chat-container-GPT-messages-bot-icon");
				botIcon.innerHTML = "B";
		
				const botBubble = document.createElement("div");
				botBubble.setAttribute("class", "chat-container-GPT-messages-bot-bubble");
				botBubble.innerHTML = this._processTextDisplay(piece.content);
		
				botSet.appendChild(botIcon);
				botSet.appendChild(botBubble);
				chatContainer.appendChild(botSet);
				
				renderMathInElement(botSet, {
					delimiters: [
						{left: "$$", right: "$$", display: true},
						{left: "$", right: "$", display: false}
					]
				});

				const rawContainer = document.createElement('pre');
				rawContainer.setAttribute("id", "raw-message");
				rawContainer.innerHTML = this._processRawDisplay(piece.content);
				botBubble.appendChild(rawContainer);
			}
			this._codeInteract();

			chatContainer.scrollTop = chatContainer.scrollHeight;
			this.dialog_num += 1;
		}

		this._codeInteract();
		this._bubbleInteract();
	}

	async _nameRecord() {
		if(this.useAgent){
			const systemPrompt = "Provide an appropriate title based on the user\'s JSON-formatted conversation records. The title should not exceed 20 words and should be returned directly. Return the content in the primary language of the conversation.";

			const recordList = await this._getRecordData();
			const index = recordList.recordIds.indexOf(this.current_record_id);
			const recordContents = recordList.recordContents[index];

			const record = document.getElementById(`record-GPT-${this.current_record_id}`);
			const recordTitle = record.children[0];

			if(recordTitle.innerHTML !== "New Chat") return;

			let title = '';
			const contentIter = this.agent.interact(systemPrompt, JSON.stringify(recordContents));
			
			for await (const piece of contentIter) {
				if (piece == undefined) continue;
				title += piece;
				recordTitle.innerHTML = title;
			}

			recordList.recordTitles[index] = title;
			await this._saveRecordData(recordList);
		}
	}
}