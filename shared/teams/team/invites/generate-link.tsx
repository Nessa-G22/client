import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RPCGen from '../../../constants/types/rpc-gen'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {ModalTitle} from '../../common'
import {FloatingRolePicker} from '../../role-picker'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {pluralize} from '../../../util/string'

type Props = Container.RouteProps<{teamID: Types.TeamID}>

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onOpenRolePicker: () => void
  onSelectRole: (role: Types.TeamRoleType) => void
  selectedRole: Types.TeamRoleType
  teamRole: Types.TeamRoleType
  disabledReasonsForRolePicker: {[K in Types.TeamRoleType]?: string}
}

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const InviteRolePicker = (props: RolePickerProps) => {
  return (
    <FloatingRolePicker
      confirmLabel={`Let in as ${pluralize(props.teamRole)}`}
      selectedRole={props.selectedRole}
      onSelectRole={props.onSelectRole}
      floatingContainerStyle={styles.floatingRolePicker}
      onConfirm={props.onConfirmRolePicker}
      onCancel={props.onCancelRolePicker}
      position="bottom center"
      open={props.isRolePickerOpen}
      disabledRoles={props.disabledReasonsForRolePicker}
    >
      <InlineDropdown
        label={capitalize(pluralize(props.teamRole))}
        onPress={props.onOpenRolePicker}
        textWrapperType="BodySemibold"
        containerStyle={styles.dropdownStyle}
        style={styles.dropdownStyle}
        selectedStyle={styles.inlineSelectedStyle}
      />
    </FloatingRolePicker>
  )
}

const InviteItem = ({
  duration,
  inviteLink,
  onExpireCallback,
  teamID,
}: {
  duration: string
  inviteLink: Types.InviteLink
  onExpireCallback: () => void
  teamID: Types.TeamID
}) => {
  const teamDetails = Container.useSelector(s => s.teams.teamDetails.get(teamID))
  const inviteLinks = teamDetails?.inviteLinks
  const inviteLinkID = [...(inviteLinks || [])].filter(i => i.url == inviteLink?.url)[0]?.id

  const dispatch = Container.useDispatch()
  const onExpire = () => {
    onExpireCallback()
    dispatch(TeamsGen.createRemovePendingInvite({inviteID: inviteLinkID, teamID}))
    inviteLink.expired = true
  }
  const waitingForExpire = Container.useAnyWaiting(Constants.removeMemberWaitingKey(teamID, inviteLinkID))

  const expireText = inviteLink.expired ? `Expired` : `Expires in ${duration}`

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inviteContainer} gap="xtiny">
      <Kb.CopyText text={inviteLink.url} disabled={inviteLink.expired || waitingForExpire} />
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmall">
          Invites as {inviteLink.role} • {expireText}
        </Kb.Text>

        {!inviteLink.expired && (
          <Kb.Box2
            direction="horizontal"
            alignSelf="flex-start"
            alignItems="center"
            gap="tiny"
            style={Styles.globalStyles.positionRelative}
          >
            <Kb.Text
              type={waitingForExpire ? 'BodySmall' : 'BodySmallPrimaryLink'}
              onClick={waitingForExpire ? undefined : onExpire}
              style={waitingForExpire ? styles.disabledText : undefined}
            >
              Expire now
            </Kb.Text>
            {waitingForExpire && (
              <Kb.Box2 direction="horizontal" centerChildren={true} style={Styles.globalStyles.fillAbsolute}>
                <Kb.ProgressIndicator type="Small" />
              </Kb.Box2>
            )}
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const waitingKey = 'generateInviteLink'

const validityOneUse = 'Expires after one use'
const validityOneYear = 'Expires after one year'
const validityForever = 'Expires after 10,000 years'

const validityValuesMap = {
  [validityForever]: '10000 Y',
  [validityOneUse]: undefined,
  [validityOneYear]: '1 Y',
}

const GenerateLinkModal = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const teamname = Container.useSelector(state => Constants.getTeamMeta(state, teamID).teamname)

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())

  const [validity, setValidity] = React.useState(validityOneYear)
  const [isRolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [teamRole, setTeamRole] = React.useState('reader' as Types.TeamRoleType)
  const [selectedRole, setSelectedRole] = React.useState('reader' as Types.TeamRoleType)
  const [inviteLink, setInviteLink] = React.useState<Types.InviteLink | null>(null)
  const [inviteDuration, setInviteDuration] = React.useState('')

  const menuItems = [
    {onClick: () => setValidity(validityOneUse), title: validityOneUse},
    {onClick: () => setValidity(validityOneYear), title: validityOneYear},
    {onClick: () => setValidity(validityForever), title: validityForever},
  ]

  const {showingPopup, toggleShowingPopup, popupAnchor, popup} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={menuItems}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
    />
  ))

  const onExpire = () => {
    if (inviteLink != null) {
      inviteLink.expired = true
    }
  }

  const generateLinkRPC = Container.useRPC(RPCGen.teamsTeamCreateSeitanInvitelinkWithDurationRpcPromise)
  const onGenerate = () => {
    const expireAfter = validityValuesMap[validity]
    const maxUses = expireAfter == null ? 1 : -1
    setInviteDuration(
      expireAfter == null ? 'one use' : validity == validityOneYear ? 'one year' : '10,000 years'
    )

    generateLinkRPC(
      [
        {
          expireAfter,
          maxUses,
          role: RPCGen.TeamRole[teamRole],
          teamname,
        },
        waitingKey,
      ],
      r => {
        setInviteLink({
          creatorUsername: '',
          expirationTime: 1000000000,
          expired: false,
          id: '1',
          lastJoinedUsername: '',
          maxUses: 1,
          numUses: 1,
          role: teamRole,
          url: r.url,
        })
      },
      () => {}
    )
  }

  const rolePickerProps = {
    disabledReasonsForRolePicker: {
      admin: `Users can't join open teams as admins.`,
      owner: `Users can't join open teams as owners.`,
      reader: '',
      writer: '',
    },
    isRolePickerOpen: isRolePickerOpen,
    onCancelRolePicker: () => setRolePickerOpen(false),
    onConfirmRolePicker: () => {
      setRolePickerOpen(false)
      setTeamRole(selectedRole)
    },
    onOpenRolePicker: () => setRolePickerOpen(true),
    onSelectRole: (role: Types.TeamRoleType) => setSelectedRole(role),
    selectedRole: selectedRole,
    teamRole: teamRole,
  }

  if (inviteLink != null) {
    return (
      <Kb.Modal
        onClose={onClose}
        header={{
          leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
          title: <ModalTitle teamID={teamID} title="Share an invite link" />,
        }}
        footer={{
          content: <Kb.Button fullWidth={true} label={'Close'} onClick={onClose} type="Dim" />,
          hideBorder: true,
        }}
        allowOverflow={true}
        mode="DefaultFullHeight"
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
          {inviteLink.expired ? (
            <Kb.Icon type="icon-illustration-teams-invite-links-grey-460-96" />
          ) : (
            <Kb.Icon type="icon-illustration-teams-invite-links-green-460-96" />
          )}
        </Kb.Box2>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={styles.body}
          gap={Styles.isMobile ? 'xsmall' : 'tiny'}
        >
          <Kb.Text type="Body" style={styles.infoText}>
            Here is your link. Share it cautiously as anyone who has it can join the team.
          </Kb.Text>

          <InviteItem
            duration={inviteDuration}
            inviteLink={inviteLink}
            onExpireCallback={onExpire}
            teamID={teamID}
          />

          {inviteLink.expired && (
            <Kb.Text type="BodySmallSemiboldPrimaryLink" onClick={() => setInviteLink(null)}>
              Generate a new link
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Modal>
    )
  }

  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Share an invite link" />,
      }}
      footer={{
        content: (
          <Kb.WaitingButton
            fullWidth={true}
            label="Generate invite link"
            onClick={onGenerate}
            waitingKey={waitingKey}
          />
        ),
        hideBorder: true,
      }}
      allowOverflow={true}
      mode="DefaultFullHeight"
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
        <Kb.Icon type="icon-illustration-teams-invite-links-blue-460-96" />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="Body" style={styles.infoText}>
          Invite people to {teamname} by sharing a link:
        </Kb.Text>

        <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} fullWidth={true} ref={popupAnchor}>
          <Kb.Text type="BodySmall" style={styles.rowTitle}>
            Validity
          </Kb.Text>
          {popup}
          <InlineDropdown
            label={validity}
            onPress={toggleShowingPopup}
            textWrapperType="BodySemibold"
            containerStyle={styles.dropdownStyle}
            style={styles.dropdownStyle}
            selectedStyle={styles.inlineSelectedStyle}
          />
        </Kb.Box2>

        <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} fullWidth={true}>
          <Kb.Text type="BodySmall" style={styles.rowTitle}>
            Invite as
          </Kb.Text>
          <InviteRolePicker {...rolePickerProps} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  banner: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  disabledText: {opacity: 0.4},
  dropdownButton: {
    alignSelf: 'center',
    paddingLeft: Styles.globalMargins.xsmall,
    width: '100%',
  },
  dropdownStyle: {
    flexGrow: 1,
    paddingRight: 0,
  },
  floatingRolePicker: Styles.platformStyles({
    isElectron: {},
  }),
  infoText: {
    marginBottom: Styles.globalMargins.xsmall,
  },
  inlineSelectedStyle: {
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: 0,
    width: '100%',
  },
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
  inviteContainer: {
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginTop: Styles.globalMargins.small,
    padding: Styles.globalMargins.tiny,
  },
  rowTitle: {
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.tiny,
    width: 62,
  },
}))

export default GenerateLinkModal
