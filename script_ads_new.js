const express = require('express');
const axios = require('axios');
const cluster = require('cluster');
const os = require('os');

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
    });
} else {
    const app = express();
    app.use(express.json());

    app.post('/ads_script_new', async (req, res) => {
        try {
            const { bot_token, block_id, collection } = req.body;

            // Выводим все данные, полученные в вебхуке
            console.log('Received data:', req.body);

            // Получаем массив telegram_id из ключа collection
            const telegramIDs = collection.map(item => item.telegram_id);

            const totalUsers = telegramIDs.length;
            const totalTimeMinutes = Math.ceil((totalUsers * (1 / 15)) / 60);

            res.json({
                status: 'ok',
                total_users: totalUsers,
                estimated_time_minutes: totalTimeMinutes
            });

            const unixtime = Math.floor(Date.now() / 1000);
            const get_webhook_info_url = `https://api.telegram.org/bot${bot_token}/getWebhookInfo`;
            let webhookUrl = (await axios.get(get_webhook_info_url)).data.result.url;

            if (!webhookUrl.startsWith('http')) {
                webhookUrl = 'https://' + webhookUrl;
            }

            for (let telegram_id of telegramIDs) {
                const main_menu_block = {
                    update_id: 6426216,
                    message: {
                        message_id: 99999999999,
                        from: {
                            id: telegram_id,
                            is_bot: false,
                            first_name: 'name',
                            language_code: 'ru'
                        },
                        chat: {
                            id: telegram_id,
                            first_name: 'name',
                            type: 'private'
                        },
                        date: unixtime,
                        text: `/b${block_id}`,
                        entities: [{ offset: 0, length: 6, type: 'bot_command' }]
                    }
                };

                try {
                    await axios.post(webhookUrl, main_menu_block);
                    console.log(`Message sent successfully to user with ID: ${telegram_id}`);
                } catch (error) {
                    console.error(`Failed to send message to user with ID: ${telegram_id}. Error: ${error.message}`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000 / 15));  
            }

        } catch (error) {
            console.error(`Error occurred: ${error.message}`);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    const PORT = 3002;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Worker ${process.pid} started on http://0.0.0.0:${PORT}`);
    });
}
