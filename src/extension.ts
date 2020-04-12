// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "calml" is now active!');

	[
		vscode.commands.registerCommand('calml.openAsHtml', () => calml('open-as-html')),
		vscode.commands.registerCommand('calml.saveHtml', () => calml('save-html')),
		vscode.commands.registerCommand('calml.savePdf', async () => await calml('save-pdf'))
	].forEach(cmd_ => context.subscriptions.push(cmd_))
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function calml(option: string) {

	if (option == 'open-as-html') { return openAsHtml();}
	else if (option == 'save-html') { return saveHtml();}
	else if (option == 'save-pdf') { return savePdf();}
}

function getLogMessage(msg: string) {
	return `[CALML] ${msg}`
}

function transpileCalmlToHtml(content: string) {	
	const style = `
	@page {
		size: A4 portrait;
		margin: 2.5rem;
	}

	* {
		font-family: Arial,Helvetica,sans-serif;
		font-size: 14px;
	}

	h1 {
		font-size: 24px;
	}

	p {
		line-height: 2;
		padding-left: 2rem;
	}
	
	br {
		line-height: 1.5;
	}
	
	section-title {
		margin-top: 1rem;
		margin-bottom: 2rem;
	}
	
	section-title::before {
		content: '[ ';
	}
	
	section-title::after {
		content: ' ]';
	}
	
	chord {
		font-weight: 700;
		margin-right: 2rem;
		line-height: 2;
		margin-top: -1.25rem !important;
		vertical-align: top;
	}
	
	p chord {
		display: inline-block;
		width: 0;
		margin-right: 0;
	}`;
		
	const match_list = [
		{
			regex: /#(.*?)#/g,
			output_format: '<h1>{}</h1>',
		}, {
			regex: /\((.*?)\)/g,
			output_format: '<p>{}</p>',
		}, {
			regex: /\{(.*?)\}/g,
			output_format: '<chord>{}</chord>',
		}, {
			regex: /\[(.*?)\]/g,
			output_format: '<section-title>{}</section-title>',
		}, {
			regex: /[\r\n]{4,}/g,
			output_format: '<br>\r\n',
		}
	];

	match_list.forEach(case_ => 
		content = 
			content.replace(
				case_.regex, 
				(match, clean_match) => 
					case_.output_format.replace('{}', clean_match)));
	
	return `<html>\r\n<body>\r\n${content}\r\n</body>\r\n</html>\r\n` + `<style>${style}</style>`;
}

function saveHtml() {
	const content = getCurrentEditorText();

	if (!content) { return; }

	vscode.window.showSaveDialog({
		saveLabel: 'Save',
	}).then((uri) => {
		if (uri) { 
			fs.writeFile(uri.path.replace('/C:/', 'C:/'), transpileCalmlToHtml(content), {}, console.log); 
		}
	})
}

function getCurrentEditorText() {	
	let editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const document = editor.document;
	
	return document.getText();
}

async function openAsHtml() {
	vscode.window.showInformationMessage('Generating your HTML');

	const content = getCurrentEditorText();

	if (!content) { return; }

	try {
		vscode.workspace.openTextDocument({
			content: transpileCalmlToHtml(content),
			language: 'html',
		}).then(doc_ => vscode.window.showTextDocument(doc_))
	} catch (error) {
		console.error(error)
	}
	
}

async function savePdf() {
	const puppeteer = require('puppeteer');

	const content = getCurrentEditorText();

	if (!content) { 
		vscode.window.showErrorMessage(getLogMessage(`No active editor to save from.`))
		return;
	}

	vscode.window.showInformationMessage(getLogMessage(`Saving PDF`))

	vscode.window.showSaveDialog({
		saveLabel: 'Save',
	}).then(async uri => {
		if (uri) { 
			const pdf_path = uri.path.replace('/C:/', 'C:/');
			const html_path = pdf_path.split('.')[0] + '_tmp.html'
			
			fs.writeFile(html_path, transpileCalmlToHtml(content), {}, console.log);

			try {
				const browser = await puppeteer.launch();
				const page = await browser.newPage();
				
				await page.goto(html_path);
				await page.emulateMedia('screen');
				await page.pdf({path:pdf_path, format:'A4'})
			
				await browser.close()		
				
				vscode.window.showInformationMessage(getLogMessage(`Pdf saved to: ${pdf_path}`));
			} catch (error) {
				vscode.window.showErrorMessage(getLogMessage('Error during pdf save.'));
			}

			await fs.unlink(html_path, () => null);
		}
	})
}
