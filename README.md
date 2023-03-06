# Welcome Bot

This app installs a listener that will post welcoming messages for users when they join configured channels.

As part of the welcoming messages it can be specified links to other rooms user should join (if public) or ask to be added (if private).

It receives as setting a json configuration. An example bellow:

``` javascript
{
    "WelcomeMessages": [
        {
            "ChannelName": "channel-0, channel-A",
            "Message": [
                "### Welcome {{USERNAME}} to the Channel #{{CHANNEL_NAME}}!",
                " Other channel of interest: #channel-1"
            ]
        }
    ]
}
```

The next step would be to extend the app to allow users owners of channels to configure through slash command new welcoming messages for their rooms.


