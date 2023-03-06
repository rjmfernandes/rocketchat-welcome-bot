import {
    IAppAccessors,
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom, IRoomUserJoinedContext, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { IPostRoomUserJoined } from '@rocket.chat/apps-engine/definition/rooms/IPostRoomUserJoined';
import { SettingType } from '@rocket.chat/apps-engine/definition/settings/SettingType';
import { IUser } from '@rocket.chat/apps-engine/definition/users/IUser';

export class WelcomeBotApp extends App implements IPostRoomUserJoined {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(
        configuration: IConfigurationExtend, environmentRead: IEnvironmentRead
    ): Promise<void> {

        await configuration.settings.provideSetting({
            id: 'welcome_bot_configuration_json',
            type: SettingType.STRING,
            packageValue: '{"WelcomeMessages":[{"ChannelName":"channel-0, channel-A","Message":["### Welcome {{USERNAME}} to the Channel #{{CHANNEL_NAME}}!"," Other channel of interest: #channel-1"]}]}',
            required: true,
            public: false,
            multiline: true,
            i18nLabel: 'welcome_bot_configuration_json',
            i18nDescription: 'welcome_bot_configuration_json_desc',
        });

    }

    async executePostRoomUserJoined(context: IRoomUserJoinedContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        const jsonConfVal = await read.getEnvironmentReader().getSettings().getValueById('welcome_bot_configuration_json');
        const jsonConf = JSON.parse(jsonConfVal);
        const roomName: string | undefined = context.room.displayName;

        if (!roomName)
            return;

        const welcomeMessage = this.getWelcomeMessage(jsonConf, roomName);

        if (welcomeMessage) {
            const msgLines: string[] = welcomeMessage.Message;
            const fullMsg: string = this.replacePlaceholders(msgLines.join('\n'), roomName, context.joiningUser.name);
            this.sendDirect(context, read, modify, fullMsg);
        }
    }
    replacePlaceholders(msg: string, roomName: string, userName: string): string {
        let i = msg.indexOf('{{');
        let j = msg.indexOf('}}');
        while (i != -1 && j != -1 && j > i) {
            let placeholder = msg.substring(i + 2, j);
            if (placeholder === 'USERNAME') {
                msg = msg.substring(0, i) + userName + msg.substring(j + 2);
            } else if (placeholder === 'CHANNEL_NAME') {
                msg = msg.substring(0, i) + roomName + msg.substring(j + 2);
            } else {
                msg = msg.substring(0, i) + 'UNKNOWN_PLACEHOLDER_KEY' + msg.substring(j + 2);
            }
            i = msg.indexOf('{{');
            j = msg.indexOf('}}');
        }
        return msg;
    }


    private async sendDirect(
        context: IRoomUserJoinedContext,
        read: IRead,
        modify: IModify,
        message: string
    ): Promise<void> {
        const messageStructure = modify.getCreator().startMessage();
        const sender = context.joiningUser;
        const appUser = await read.getUserReader().getAppUser();
        if (!appUser) {
            throw new Error("Something went wrong getting App User!");
        }
        // lets use a function we created to get or create direct room
        let room = (await this.getOrCreateDirectRoom(read, modify, [
            sender.username,
            appUser.username,
        ])) as IRoom;
        messageStructure.setRoom(room).setText(message); // set the text message
        await modify.getCreator().finish(messageStructure); // sends the message in the room.
    }

    private async getOrCreateDirectRoom(
        read: IRead,
        modify: IModify,
        usernames: Array<string>,
        creator?: IUser
    ) {
        let room;
        // first, let's try to get the direct room for given usernames
        try {
            room = await read.getRoomReader().getDirectByUsernames(usernames);
        } catch (error) {
            return;
        }
        // nice, room exist already, lets return it.
        if (room) {
            return room;
        } else {
            // no room for the given users. Lets create a room now!
            // for flexibility, we might allow different creators
            // if no creator, use app user bot
            if (!creator) {
                creator = await read.getUserReader().getAppUser();
                if (!creator) {
                    throw new Error("Error while getting AppUser");
                }
            }

            let roomId: string;
            // Create direct room
            const newRoom = modify
                .getCreator()
                .startRoom()
                .setType(RoomType.DIRECT_MESSAGE)
                .setCreator(creator)
                .setMembersToBeAddedByUsernames(usernames);
            roomId = await modify.getCreator().finish(newRoom);
            return await read.getRoomReader().getById(roomId);
        }
    }

    getWelcomeMessage(jsonConf: any, roomId: string): any {
        for (let i = 0; i < jsonConf.WelcomeMessages.length; ++i) {
            let welcomeMsg = jsonConf.WelcomeMessages[i];
            let rooms: string[] = welcomeMsg.ChannelName.split(',');
            if (rooms.indexOf(roomId) != -1) {
                return welcomeMsg;
            }
        }
        return null;
    }
}
